import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { EventLoopWindow } from '../modules/stats/stats.schema'

import { type BackSample, cpuPercent, mergeWindows } from './back-sampler'
import type { LoadConfig } from './config'
import type { Phase, PhaseSpan, RecorderSnapshot } from './recorder'
import type { SseConnectionReport } from './sse-client'
import { maxOf, meanOf, percentile, type Summary, summarize } from './stats'

// The run's report (#136): one JSON for machines, one Markdown for people.
// What fails a run is a closed list (decision 7 of the plan): a 5xx, an
// unexpected status, a network error or timeout, an SSE connection that
// never opened or dropped, an invalid SSE payload, an incoherent verdict, an
// action started and never completed, a setup error, an abort. Latency,
// CPU, memory and lag are observations — they never fail a run.

export type HarnessEnvironment = {
  node: string
  commit: string | null
  // os.loadavg() of the harness machine at start and end, and its
  // availableParallelism(): another suite on the same machine moves every
  // number (#431), and these say whether that happened.
  loadavgStart: number[]
  loadavgEnd: number[]
  parallelism: number
}

export type WorldSummary = {
  teams: number
  participants: number
  membersPerTeam: number
  maxTeamSize: number
  before: { participants: number; teams: number }
  round: { id: string; name: string } | null
  problemId: string | null
  closedLeftoverRounds: string[]
}

export type PhaseSummary = {
  phase: Phase
  durationSeconds: number | null
  cpuPercent: { mean: number | null; max: number | null }
  rssMaxBytes: number | null
  heapUsedMaxBytes: number | null
  // Over the event-loop windows that closed during the phase.
  lag: { p99OfWindowP99Ms: number | null; maxMs: number | null }
  eluMean: number | null
  judgeWaitingMax: number | null
  sseConnectionsMax: number | null
  samples: number
}

export type SseSummary = {
  requested: number
  opened: number
  failedToOpen: number
  failedToOpenBy: Record<string, number>
  dropped: number
  droppedBy: Record<string, number>
  closedByHarness: number
  // Per opened connection, events of each type: min / mean / max.
  eventsPerConnection: Record<string, { min: number; mean: number; max: number }>
  heartbeatIntervalMs: Summary
  invalidPayloads: number
  invalidSamples: string[]
}

export type LoadReport = {
  scenario: LoadConfig['scenario']
  runId: string
  target: string
  status: 'PASS' | 'FAIL'
  failures: string[]
  warnings: string[]
  aborted: boolean
  startedAt: string
  endedAt: string
  environment: HarnessEnvironment
  config: Omit<LoadConfig, 'organizerPassword'>
  world: WorldSummary | null
  phases: PhaseSummary[]
  http: RecorderSnapshot['http']
  unexpected: RecorderSnapshot['unexpected']
  actions: RecorderSnapshot['actions']
  verdicts: RecorderSnapshot['verdicts']
  sse: SseSummary
  // Raw, JSON only: every back sample and every event-loop window.
  timeline: { samples: BackSample[]; windows: EventLoopWindow[] }
}

export type ReportInput = {
  config: LoadConfig
  runId: string
  startedAt: number
  endedAt: number
  aborted: boolean
  environment: HarnessEnvironment
  recorder: RecorderSnapshot
  world: WorldSummary | null
  sse: { requested: number; connections: SseConnectionReport[] }
  samples: BackSample[]
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1
}

export function summarizeSse(requested: number, connections: SseConnectionReport[]): SseSummary {
  const failedToOpenBy: Record<string, number> = {}
  const droppedBy: Record<string, number> = {}
  let closedByHarness = 0
  let invalidPayloads = 0
  const invalidSamples: string[] = []
  const heartbeatIntervals: number[] = []
  const opened = connections.filter((c) => c.state !== 'failed')
  for (const connection of connections) {
    invalidPayloads += connection.invalidPayloads
    for (const sample of connection.invalidSamples) {
      if (invalidSamples.length < 5) invalidSamples.push(sample)
    }
    heartbeatIntervals.push(...connection.heartbeatIntervalsMs)
    if (connection.state === 'failed') {
      const failure = connection.failure
      const key = failure?.status
        ? `${failure.status}${failure.errorCode ? `:${failure.errorCode}` : ''}`
        : (failure?.reason ?? 'unknown')
      increment(failedToOpenBy, key)
    } else if (connection.state === 'dropped') {
      increment(droppedBy, connection.dropReason ?? 'unknown')
    } else if (connection.state === 'closed') {
      closedByHarness += 1
    }
  }

  const types = new Set(opened.flatMap((c) => Object.keys(c.events)))
  const eventsPerConnection: SseSummary['eventsPerConnection'] = {}
  for (const type of [...types].sort()) {
    const counts = opened.map((c) => c.events[type] ?? 0)
    eventsPerConnection[type] = {
      min: Math.min(...counts),
      mean: meanOf(counts) ?? 0,
      max: Math.max(...counts),
    }
  }

  const failedToOpen = connections.length - opened.length
  return {
    requested,
    opened: opened.length,
    failedToOpen,
    failedToOpenBy,
    dropped: Object.values(droppedBy).reduce((a, b) => a + b, 0),
    droppedBy,
    closedByHarness,
    eventsPerConnection,
    heartbeatIntervalMs: summarize(heartbeatIntervals),
    invalidPayloads,
    invalidSamples,
  }
}

function within(at: number, span: PhaseSpan): boolean {
  return at >= span.startedAt && (span.endedAt === null || at <= span.endedAt)
}

export function summarizePhases(
  spans: PhaseSpan[],
  samples: BackSample[],
  windows: EventLoopWindow[],
): PhaseSummary[] {
  return spans.map((span) => {
    const inPhase = samples.filter((sample) => within(sample.at, span))
    const cpu: number[] = []
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1]?.process
      const next = samples[i]
      if (!prev || !next?.process || !within(next.at, span)) continue
      const value = cpuPercent(prev, next.process)
      if (value !== null) cpu.push(value)
    }
    const phaseWindows = windows.filter((window) => within(window.endedAt, span))
    const p99s = phaseWindows.map((window) => window.delayP99Ms).sort((a, b) => a - b)
    return {
      phase: span.phase,
      durationSeconds: span.endedAt === null ? null : (span.endedAt - span.startedAt) / 1000,
      cpuPercent: { mean: meanOf(cpu), max: maxOf(cpu) },
      rssMaxBytes: maxOf(inPhase.flatMap((s) => (s.process ? [s.process.memory.rss] : []))),
      heapUsedMaxBytes: maxOf(
        inPhase.flatMap((s) => (s.process ? [s.process.memory.heapUsed] : [])),
      ),
      lag: {
        p99OfWindowP99Ms: percentile(p99s, 99),
        maxMs: maxOf(phaseWindows.map((window) => window.delayMaxMs)),
      },
      eluMean: meanOf(phaseWindows.map((window) => window.utilization)),
      judgeWaitingMax: maxOf(inPhase.flatMap((s) => (s.live ? [s.live.judge.waiting] : []))),
      sseConnectionsMax: maxOf(inPhase.flatMap((s) => (s.live ? [s.live.sse.connections] : []))),
      samples: inPhase.length,
    }
  })
}

/** The failure list — empty means PASS. See the rules at the top of the file. */
export function buildFailures(input: {
  recorder: RecorderSnapshot
  sse: SseSummary
  aborted: boolean
}): string[] {
  const failures: string[] = []
  const { recorder, sse } = input

  for (const message of recorder.setupErrors) failures.push(`setup failed: ${message}`)

  for (const [phase, routes] of Object.entries(recorder.http)) {
    for (const [route, stats] of Object.entries(routes ?? {})) {
      const serverErrors = Object.entries(stats.byStatus).filter(([key]) => key.startsWith('5'))
      for (const [key, count] of serverErrors) {
        failures.push(`${count}× ${key} on ${route} (${phase})`)
      }
      if (stats.networkErrors > 0) {
        failures.push(
          `${stats.networkErrors}× network error on ${route} (${phase}), ${stats.timeouts} of them timeouts`,
        )
      }
    }
  }

  for (const entry of recorder.unexpected) {
    const status = entry.errorCode ? `${entry.status}:${entry.errorCode}` : String(entry.status)
    failures.push(`${entry.count}× unexpected ${status} on ${entry.route} (${entry.phase})`)
  }

  for (const [kind, counts] of Object.entries(recorder.actions)) {
    if (counts.started !== counts.completed) {
      failures.push(
        `${kind}: ${counts.started} started, ${counts.completed} completed (${counts.started - counts.completed} never finished)`,
      )
    }
  }

  if (recorder.verdicts.incoherent > 0) {
    failures.push(
      `${recorder.verdicts.incoherent} incoherent verdict(s): ${JSON.stringify(recorder.verdicts.matrix)}`,
    )
  }

  if (sse.failedToOpen > 0) {
    failures.push(
      `${sse.failedToOpen} SSE connection(s) failed to open: ${JSON.stringify(sse.failedToOpenBy)}`,
    )
  }
  if (sse.dropped > 0) {
    failures.push(`${sse.dropped} SSE connection(s) dropped: ${JSON.stringify(sse.droppedBy)}`)
  }
  if (sse.invalidPayloads > 0) {
    failures.push(`${sse.invalidPayloads} invalid SSE payload(s)`)
  }

  if (input.aborted) failures.push('run aborted before the end (SIGINT) — this report is partial')
  return failures
}

export function buildReport(input: ReportInput): LoadReport {
  const sse = summarizeSse(input.sse.requested, input.sse.connections)
  const windows = mergeWindows(input.samples)
  const failures = buildFailures({ recorder: input.recorder, sse, aborted: input.aborted })
  const { organizerPassword: _password, ...config } = input.config
  return {
    scenario: input.config.scenario,
    runId: input.runId,
    target: input.config.url,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    warnings: input.recorder.warnings,
    aborted: input.aborted,
    startedAt: new Date(input.startedAt).toISOString(),
    endedAt: new Date(input.endedAt).toISOString(),
    environment: input.environment,
    config,
    world: input.world,
    phases: summarizePhases(input.recorder.phases, input.samples, windows),
    http: input.recorder.http,
    unexpected: input.recorder.unexpected,
    actions: input.recorder.actions,
    verdicts: input.recorder.verdicts,
    sse,
    timeline: { samples: input.samples, windows },
  }
}

// --- Markdown ---

const dash = '—'

function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return dash
  return Number.isInteger(value) ? String(value) : value.toFixed(digits)
}

function mib(bytes: number | null): string {
  return bytes === null ? dash : (bytes / 1024 / 1024).toFixed(1)
}

function loadavg(values: number[]): string {
  return values.map((value) => value.toFixed(2)).join(' / ')
}

function table(headers: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n')
}

function statusCounts(byStatus: Record<string, number>): string {
  return Object.entries(byStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}×${count}`)
    .join(', ')
}

export function renderMarkdown(report: LoadReport): string {
  const out: string[] = []
  out.push(`# Load report: ${report.scenario} \`${report.runId}\``)
  out.push('')
  out.push(`**${report.status}**${report.aborted ? ' (aborted, partial)' : ''}`)
  out.push('')
  if (report.failures.length > 0) {
    out.push('## Failures')
    out.push('')
    for (const failure of report.failures) out.push(`- ${failure}`)
    out.push('')
  }
  if (report.warnings.length > 0) {
    out.push('## Warnings')
    out.push('')
    for (const warning of report.warnings) out.push(`- ${warning}`)
    out.push('')
  }

  const env = report.environment
  out.push('## Run')
  out.push('')
  out.push(
    table(
      ['field', 'value'],
      [
        ['target', report.target],
        ['started', report.startedAt],
        ['ended', report.endedAt],
        ['node', env.node],
        ['commit', env.commit ?? dash],
        ['harness loadavg (1/5/15 min) at start', loadavg(env.loadavgStart)],
        ['harness loadavg (1/5/15 min) at end', loadavg(env.loadavgEnd)],
        ['harness available parallelism', String(env.parallelism)],
      ],
    ),
  )
  out.push('')
  out.push('## Config')
  out.push('')
  out.push(
    table(
      ['option', 'value'],
      Object.entries(report.config).map(([key, value]) => [key, String(value ?? dash)]),
    ),
  )
  out.push('')

  out.push('## World')
  out.push('')
  if (report.world) {
    const world = report.world
    out.push(
      table(
        ['field', 'value'],
        [
          ['teams', String(world.teams)],
          ['participants', String(world.participants)],
          ['members per team', `${world.membersPerTeam} (maxTeamSize ${world.maxTeamSize})`],
          [
            'already in the database before setup',
            `${world.before.participants} participant(s), ${world.before.teams} team(s)`,
          ],
          ['round', world.round ? `${world.round.name} (${world.round.id})` : dash],
          ['problem', world.problemId ?? dash],
          ['leftover rounds closed', world.closedLeftoverRounds.join(', ') || dash],
        ],
      ),
    )
  } else {
    out.push('Setup did not complete.')
  }
  out.push('')

  out.push('## Phases (back process)')
  out.push('')
  out.push(
    table(
      [
        'phase',
        'duration s',
        'CPU % mean',
        'CPU % max',
        'RSS max MiB',
        'heap max MiB',
        'lag p99 ms',
        'lag max ms',
        'ELU mean',
        'judge waiting max',
        'SSE (server) max',
        'samples',
      ],
      report.phases.map((phase) => [
        phase.phase,
        num(phase.durationSeconds),
        num(phase.cpuPercent.mean),
        num(phase.cpuPercent.max),
        mib(phase.rssMaxBytes),
        mib(phase.heapUsedMaxBytes),
        num(phase.lag.p99OfWindowP99Ms),
        num(phase.lag.maxMs),
        num(phase.eluMean, 3),
        num(phase.judgeWaitingMax, 0),
        num(phase.sseConnectionsMax, 0),
        String(phase.samples),
      ]),
    ),
  )
  out.push('')
  out.push(
    'CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.',
  )
  out.push('')

  out.push('## HTTP by route')
  out.push('')
  for (const [phase, routes] of Object.entries(report.http)) {
    out.push(`### ${phase}`)
    out.push('')
    out.push(
      table(
        ['route', 'count', 'statuses', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms', 'network errors'],
        Object.entries(routes ?? {}).map(([route, stats]) => [
          `\`${route}\``,
          String(stats.count),
          statusCounts(stats.byStatus),
          num(stats.latencyMs.p50),
          num(stats.latencyMs.p95),
          num(stats.latencyMs.p99),
          num(stats.latencyMs.max),
          stats.networkErrors > 0 ? `${stats.networkErrors} (${stats.timeouts} timeouts)` : '0',
        ]),
      ),
    )
    out.push('')
  }
  out.push('Latency is until the end of the body; for `GET /sse`, until the headers.')
  out.push('')

  out.push('## Verdicts')
  out.push('')
  const matrix = report.verdicts.matrix
  const verdictKeys = [
    ...new Set(Object.values(matrix).flatMap((row) => Object.keys(row ?? {}))),
  ].sort()
  if (verdictKeys.length === 0) {
    out.push('No submissions.')
  } else {
    out.push(
      table(
        ['sent', ...verdictKeys],
        Object.entries(matrix).map(([kind, row]) => [
          kind,
          ...verdictKeys.map((key) => String((row as Record<string, number>)[key] ?? 0)),
        ]),
      ),
    )
    out.push('')
    out.push(`Incoherent: ${report.verdicts.incoherent}`)
  }
  out.push('')

  out.push('## Actions')
  out.push('')
  out.push(
    table(
      ['action', 'started', 'completed'],
      Object.entries(report.actions).map(([kind, counts]) => [
        kind,
        String(counts.started),
        String(counts.completed),
      ]),
    ),
  )
  out.push('')

  const sse = report.sse
  out.push('## SSE')
  out.push('')
  out.push(
    table(
      ['field', 'value'],
      [
        ['requested', String(sse.requested)],
        ['opened', String(sse.opened)],
        [
          'failed to open',
          `${sse.failedToOpen}${sse.failedToOpen ? ` ${JSON.stringify(sse.failedToOpenBy)}` : ''}`,
        ],
        ['dropped', `${sse.dropped}${sse.dropped ? ` ${JSON.stringify(sse.droppedBy)}` : ''}`],
        ['closed by the harness', String(sse.closedByHarness)],
        ['invalid payloads', String(sse.invalidPayloads)],
        [
          'heartbeat interval ms (p50 / p95 / p99 / max)',
          [
            sse.heartbeatIntervalMs.p50,
            sse.heartbeatIntervalMs.p95,
            sse.heartbeatIntervalMs.p99,
            sse.heartbeatIntervalMs.max,
          ]
            .map((value) => num(value))
            .join(' / '),
        ],
      ],
    ),
  )
  out.push('')
  out.push(
    table(
      ['event', 'per connection min', 'mean', 'max'],
      Object.entries(sse.eventsPerConnection).map(([type, counts]) => [
        type,
        String(counts.min),
        num(counts.mean),
        String(counts.max),
      ]),
    ),
  )
  out.push('')
  return out.join('\n')
}

/** Writes report.md and report.json into `dir`, creating it. */
export async function writeReport(report: LoadReport, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(join(dir, 'report.md'), `${renderMarkdown(report)}\n`)
  return dir
}
