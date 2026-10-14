import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { JudgeRun, JudgeRunOutcome, JudgeTimings } from '../modules/judge/judge.schema'
import type { SseConnect, SseEmission } from '../modules/sse/sse.schema'
import type { EventLoopWindow } from '../modules/stats/stats.schema'

import {
  type BackSample,
  cpuPercent,
  type MergedTimings,
  mergeTimings,
  mergeWindows,
} from './back-sampler'
import type { LoadConfig } from './config'
import type { HarnessSample } from './harness-sampler'
import type { Phase, PhaseSpan, RecorderSnapshot } from './recorder'
import type { ConsistencyCheck, DrainCheck } from './settle'
import type { SseConnectionReport } from './sse-client'
import { maxOf, meanOf, percentile, type Summary, summarize } from './stats'

// The run's report (#136): one JSON for machines, one Markdown for people.
// What fails a run is a closed list (decision 7 of the plan): a 5xx, an
// unexpected status, a network error or timeout, an SSE connection that
// never opened or dropped, an invalid SSE payload, an incoherent verdict, an
// action started and never completed, a setup error, an abort. #137/#138
// add: a judge that did not drain (or left a busy worker alive), and an SSE
// ranking that differs between connections or from the API, after the load
// or after the storm. Latency, queue, spawn, CPU, memory, lag, bytes and
// heartbeat cadence are observations — they never fail a run; so is the
// harness's own saturation (#442), which only adds a warning.

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
  // #138: every problem of the round, and the closed rounds before it.
  problemIds: string[]
  pastRounds: { id: string; name: string }[]
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

// --- The harness's own process (#442) ---

/** A phase whose mean event-loop utilization reaches this is saturated. */
export const HARNESS_SATURATED_ELU = 0.9
/**
 * A phase where the harness's loop stalled this long is saturated: the
 * heartbeat's period, so one stall already moves the gaps it measures.
 */
export const HARNESS_STALL_MS = 1000

export type HarnessPhaseSummary = {
  phase: Phase
  cpuPercent: { mean: number | null; max: number | null }
  elu: { mean: number | null; max: number | null }
  // Over the harness's windows that closed during the phase.
  lag: { p99OfWindowP99Ms: number | null; maxMs: number | null }
  // The longest time between two answers of the back sampler, the later one
  // in the phase: a saturated harness polls late, and so does a slow back
  // (the gap includes the poll's own answer time).
  maxPollGapMs: number | null
  samples: number
  // Mean ELU ≥ HARNESS_SATURATED_ELU or a lag ≥ HARNESS_STALL_MS. A warning,
  // never a failure.
  saturated: boolean
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
  // #138: each opened connection's largest heartbeat gap.
  maxHeartbeatGapMs: Summary
  invalidPayloads: number
  invalidSamples: string[]
}

// --- #137/#138 sections ---

export type SettleReport = { drain: DrainCheck; consistency: ConsistencyCheck }

export type StormInput = {
  // Connections open before the storm: as many are reopened.
  requested: number
  windowSeconds: number
  connections: SseConnectionReport[]
  consistency: ConsistencyCheck
}

export type StormReport = {
  requested: number
  windowSeconds: number
  sse: SseSummary
  // From the start of each connect.
  headersMs: Summary
  firstStateSyncMs: Summary
  firstRankingMs: Summary
  consistency: ConsistencyCheck
}

export type JudgeStageSummary = {
  count: number
  queueMs: Summary
  spawnMs: Summary
  execMs: Summary
  // queue + spawn + exec: arrival to the last case's reply.
  totalMs: Summary
}

export type FirstWavePoint = {
  k: number
  // The k-th arrival's own queue wait, and the p95 over the first k.
  kthQueueMs: number
  p95QueueMs: number
}

export type JudgeReport = {
  // Runs that arrived during the load phase.
  runs: number
  byOutcome: Partial<Record<JudgeRunOutcome, number>>
  all: JudgeStageSummary
  byOutcomeTimings: Partial<Record<JudgeRunOutcome, JudgeStageSummary>>
  // spawn ÷ (spawn + exec), over the passed runs: does the spawn dominate?
  spawnShareOfPassed: Summary
  waitingAtArrivalMax: number | null
  firstWave: {
    points: FirstWavePoint[]
    thresholdMs: number
    // Smallest k whose p95 over the first k arrivals passes the threshold.
    firstKAboveThreshold: number | null
  }
  // From the last back read.
  workers: JudgeTimings['workers'] | null
  config: JudgeTimings['config'] | null
}

export type EmissionSummary = {
  phase: Phase
  kind: SseEmission['kind']
  count: number
  subscribersMax: number | null
  publishMs: Summary
  openRoundMs: Summary
  roundRankingMs: Summary
  eventRankingMs: Summary
}

export type ConnectSummary = {
  phase: Phase
  count: number
  stateSyncMs: Summary
  // openRound + roundRanking + eventRanking.
  rankingMs: Summary
  totalMs: Summary
  concurrentMax: number | null
}

export type PayloadSummary = {
  type: string
  events: number
  minBytes: number
  meanBytes: number
  maxBytes: number
}

export type SseCostReport = {
  payloads: PayloadSummary[]
  // The largest ranking.updated × the connections opened: bytes one ranking
  // emission writes in total.
  rankingBandwidthPerEmissionBytes: number | null
  emissions: EmissionSummary[]
  connects: ConnectSummary[]
}

/** Where a first wave's queue wait is felt (Q1 of #137's plan): one cooldown. */
export const FIRST_WAVE_THRESHOLD_MS = 5000
const FIRST_WAVE_KS = [10, 25, 50, 75, 100]

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
  // #442: the harness's own CPU, ELU and lag per phase, and the SSE payloads
  // it validated (null when the run had no shared cache).
  harness: HarnessPhaseSummary[]
  payloadCache: { distinct: number; reused: number } | null
  http: RecorderSnapshot['http']
  unexpected: RecorderSnapshot['unexpected']
  retries: RecorderSnapshot['retries']
  actions: RecorderSnapshot['actions']
  verdicts: RecorderSnapshot['verdicts']
  submissions: RecorderSnapshot['submissions']
  sse: SseSummary
  judge: JudgeReport | null
  sseCost: SseCostReport
  settle: SettleReport | null
  storm: StormReport | null
  // Raw, JSON only: every back sample and every event-loop window. Each
  // sample's own copy of the ring is dropped (`windows: []`): every read
  // returns the last 120 windows, so keeping them per sample made a 4-minute
  // baseline's JSON 9 MB of repeats. The deduplicated list is `windows`, and
  // likewise the judge runs, emissions and connects (#137/#138). `harness`:
  // the harness's own samples (#442).
  timeline: {
    samples: BackSample[]
    windows: EventLoopWindow[]
    harness: HarnessSample[]
  } & MergedTimings
}

/**
 * A sample without its copy of the event-loop ring nor its judge and SSE
 * entries: those are kept once each in `timeline`.
 */
export function withoutRing(sample: BackSample): BackSample {
  if (!sample.process) return sample
  return {
    ...sample,
    process: {
      ...sample.process,
      eventLoop: { ...sample.process.eventLoop, windows: [] },
      judge: { ...sample.process.judge, runs: [] },
      sse: { emissions: [], connects: [] },
    },
  }
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
  settle?: SettleReport | null
  storm?: StormInput | null
  samples: BackSample[]
  harnessSamples?: HarnessSample[]
  payloadCache?: { distinct: number; reused: number } | null
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
  const maxGaps = opened.flatMap((c) => (c.maxHeartbeatGapMs === null ? [] : [c.maxHeartbeatGapMs]))
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
    maxHeartbeatGapMs: summarize(maxGaps),
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

/** The harness's own process per phase, and whether it saturated (#442). */
export function summarizeHarness(
  spans: PhaseSpan[],
  harnessSamples: HarnessSample[],
  backSamples: BackSample[],
): HarnessPhaseSummary[] {
  const valuesOf = (samples: HarnessSample[], pick: (sample: HarnessSample) => number | null) =>
    samples.flatMap((sample) => {
      const value = pick(sample)
      return value === null ? [] : [value]
    })
  return spans.map((span) => {
    const inPhase = harnessSamples.filter((sample) => within(sample.at, span))
    const cpu = valuesOf(inPhase, (sample) => sample.cpuPercent)
    const elu = valuesOf(inPhase, (sample) => sample.elu)
    const p99s = valuesOf(inPhase, (sample) => sample.lagP99Ms).sort((a, b) => a - b)
    const lagMax = maxOf(valuesOf(inPhase, (sample) => sample.lagMaxMs))
    const pollGaps: number[] = []
    for (let i = 1; i < backSamples.length; i++) {
      const prev = backSamples[i - 1]
      const next = backSamples[i]
      if (prev && next && within(next.at, span)) pollGaps.push(next.at - prev.at)
    }
    const eluMean = meanOf(elu)
    return {
      phase: span.phase,
      cpuPercent: { mean: meanOf(cpu), max: maxOf(cpu) },
      elu: { mean: eluMean, max: maxOf(elu) },
      lag: { p99OfWindowP99Ms: percentile(p99s, 99), maxMs: lagMax },
      maxPollGapMs: maxOf(pollGaps),
      samples: inPhase.length,
      saturated:
        (eluMean !== null && eluMean >= HARNESS_SATURATED_ELU) ||
        (lagMax !== null && lagMax >= HARNESS_STALL_MS),
    }
  })
}

function harnessWarnings(harness: HarnessPhaseSummary[]): string[] {
  return harness
    .filter((phase) => phase.saturated)
    .map(
      (phase) =>
        `harness saturated in ${phase.phase} (ELU mean ${num(phase.elu.mean, 2)}, lag max ${num(phase.lag.maxMs, 0)} ms): heartbeat gaps, poll gaps and latencies of this phase measure the harness, not the back`,
    )
}

function spanOf(spans: PhaseSpan[], phase: Phase): PhaseSpan | undefined {
  return spans.find((span) => span.phase === phase)
}

function phaseAt(spans: PhaseSpan[], at: number): Phase | null {
  return spans.find((span) => within(at, span))?.phase ?? null
}

function stageSummary(runs: JudgeRun[]): JudgeStageSummary {
  return {
    count: runs.length,
    queueMs: summarize(runs.map((run) => run.queueMs)),
    spawnMs: summarize(runs.flatMap((run) => (run.spawnMs === null ? [] : [run.spawnMs]))),
    execMs: summarize(runs.map((run) => run.execMs)),
    totalMs: summarize(runs.map((run) => run.queueMs + (run.spawnMs ?? 0) + run.execMs)),
  }
}

/** The queue wait of the k-th arrival, and the p95 over the first k. */
export function firstWaveCurve(
  runs: JudgeRun[],
  ks: readonly number[] = FIRST_WAVE_KS,
  thresholdMs = FIRST_WAVE_THRESHOLD_MS,
): JudgeReport['firstWave'] {
  const byArrival = [...runs].sort((a, b) => a.arrivedAt - b.arrivedAt || a.seq - b.seq)
  const p95Of = (k: number) =>
    percentile(
      byArrival
        .slice(0, k)
        .map((run) => run.queueMs)
        .sort((a, b) => a - b),
      95,
    ) ?? 0
  const points = ks
    .filter((k) => k <= byArrival.length)
    .map((k) => ({ k, kthQueueMs: (byArrival[k - 1] as JudgeRun).queueMs, p95QueueMs: p95Of(k) }))
  let firstKAboveThreshold: number | null = null
  for (let k = 1; k <= byArrival.length; k++) {
    if (p95Of(k) > thresholdMs) {
      firstKAboveThreshold = k
      break
    }
  }
  return { points, thresholdMs, firstKAboveThreshold }
}

export function summarizeJudge(
  runs: JudgeRun[],
  spans: PhaseSpan[],
  samples: BackSample[],
): JudgeReport | null {
  const load = spanOf(spans, 'load')
  if (!load) return null
  const inLoad = runs.filter((run) => within(run.arrivedAt, load))
  const byOutcome: JudgeReport['byOutcome'] = {}
  const groups = new Map<JudgeRunOutcome, JudgeRun[]>()
  for (const run of inLoad) {
    byOutcome[run.outcome] = (byOutcome[run.outcome] ?? 0) + 1
    groups.set(run.outcome, [...(groups.get(run.outcome) ?? []), run])
  }
  const byOutcomeTimings: JudgeReport['byOutcomeTimings'] = {}
  for (const [outcome, group] of groups) byOutcomeTimings[outcome] = stageSummary(group)
  const shares = (groups.get('passed') ?? []).flatMap((run) =>
    run.spawnMs === null || run.spawnMs + run.execMs === 0
      ? []
      : [run.spawnMs / (run.spawnMs + run.execMs)],
  )
  const last = [...samples].reverse().find((sample) => sample.process)?.process ?? null
  return {
    runs: inLoad.length,
    byOutcome,
    all: stageSummary(inLoad),
    byOutcomeTimings,
    spawnShareOfPassed: summarize(shares),
    waitingAtArrivalMax: maxOf(inLoad.map((run) => run.waitingAtArrival)),
    firstWave: firstWaveCurve(inLoad),
    workers: last?.judge.workers ?? null,
    config: last?.judge.config ?? null,
  }
}

export function summarizePayloads(connections: SseConnectionReport[]): PayloadSummary[] {
  const byType = new Map<string, { events: number; total: number; min: number; max: number }>()
  for (const connection of connections) {
    for (const [type, stats] of Object.entries(connection.bytes)) {
      const entry = byType.get(type)
      if (entry) {
        entry.events += stats.count
        entry.total += stats.total
        entry.min = Math.min(entry.min, stats.min)
        entry.max = Math.max(entry.max, stats.max)
      } else {
        byType.set(type, {
          events: stats.count,
          total: stats.total,
          min: stats.min,
          max: stats.max,
        })
      }
    }
  }
  return [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, entry]) => ({
      type,
      events: entry.events,
      minBytes: entry.min,
      meanBytes: entry.events === 0 ? 0 : entry.total / entry.events,
      maxBytes: entry.max,
    }))
}

export function summarizeEmissions(
  emissions: SseEmission[],
  spans: PhaseSpan[],
): EmissionSummary[] {
  const groups = new Map<string, { phase: Phase; kind: SseEmission['kind']; list: SseEmission[] }>()
  for (const emission of emissions) {
    const phase = phaseAt(spans, emission.endedAt)
    if (!phase) continue
    const key = `${phase}|${emission.kind}`
    const group = groups.get(key) ?? { phase, kind: emission.kind, list: [] }
    group.list.push(emission)
    groups.set(key, group)
  }
  const order = (phase: Phase) => spans.findIndex((span) => span.phase === phase)
  return [...groups.values()]
    .sort((a, b) => order(a.phase) - order(b.phase) || a.kind.localeCompare(b.kind))
    .map(({ phase, kind, list }) => {
      const stages = list.flatMap((emission) => (emission.stages ? [emission.stages] : []))
      return {
        phase,
        kind,
        count: list.length,
        subscribersMax: maxOf(list.map((emission) => emission.subscribers)),
        publishMs: summarize(list.map((emission) => emission.publishMs)),
        openRoundMs: summarize(stages.map((stage) => stage.openRoundMs)),
        roundRankingMs: summarize(stages.map((stage) => stage.roundRankingMs)),
        eventRankingMs: summarize(stages.map((stage) => stage.eventRankingMs)),
      }
    })
}

export function summarizeConnects(connects: SseConnect[], spans: PhaseSpan[]): ConnectSummary[] {
  const groups = new Map<Phase, SseConnect[]>()
  for (const connect of connects) {
    const phase = phaseAt(spans, connect.endedAt)
    if (!phase) continue
    groups.set(phase, [...(groups.get(phase) ?? []), connect])
  }
  const order = (phase: Phase) => spans.findIndex((span) => span.phase === phase)
  return [...groups.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([phase, list]) => ({
      phase,
      count: list.length,
      stateSyncMs: summarize(list.map((connect) => connect.stateSyncMs)),
      rankingMs: summarize(
        list.map(
          (connect) => connect.openRoundMs + connect.roundRankingMs + connect.eventRankingMs,
        ),
      ),
      totalMs: summarize(list.map((connect) => connect.totalMs)),
      concurrentMax: maxOf(list.map((connect) => connect.concurrent)),
    }))
}

function firstEventSummary(connections: SseConnectionReport[], type: string): Summary {
  return summarize(
    connections.flatMap((connection) => {
      const at = connection.firstEventMs[type]
      return at === undefined ? [] : [at]
    }),
  )
}

export function summarizeStorm(storm: StormInput): StormReport {
  const opened = storm.connections.filter((connection) => connection.state !== 'failed')
  return {
    requested: storm.requested,
    windowSeconds: storm.windowSeconds,
    sse: summarizeSse(storm.requested, storm.connections),
    headersMs: summarize(
      opened.flatMap((connection) => (connection.headersMs === null ? [] : [connection.headersMs])),
    ),
    firstStateSyncMs: firstEventSummary(opened, 'state.sync'),
    firstRankingMs: firstEventSummary(opened, 'ranking.updated'),
    consistency: storm.consistency,
  }
}

function consistencyFailure(at: string, check: ConsistencyCheck): string | null {
  if (check.matchesApi !== false) return null
  return `SSE ranking diverged ${at}: ${check.compared} connection(s) compared, ${check.withoutRanking} without a ranking, ${check.distinctDigests} distinct digest(s), API digest ${check.apiDigest === null ? 'unreadable' : 'not matched'}`
}

/** The failure list — empty means PASS. See the rules at the top of the file. */
export function buildFailures(input: {
  recorder: RecorderSnapshot
  sse: SseSummary
  aborted: boolean
  settle?: SettleReport | null
  storm?: StormReport | null
}): string[] {
  const failures: string[] = []
  const { recorder, sse } = input

  for (const { phase, message } of recorder.errors) failures.push(`${phase} failed: ${message}`)

  for (const [phase, routes] of Object.entries(recorder.http)) {
    for (const [route, stats] of Object.entries(routes ?? {})) {
      const serverErrors = Object.entries(stats.byStatus).filter(([key]) => key.startsWith('5'))
      for (const [key, count] of serverErrors) {
        failures.push(`${count}× ${key} on ${route} (${phase})`)
      }
      // A retried error is reported (`retries`), not failed: the request was
      // sent again, and the retry's own outcome is what counts.
      const retried = recorder.retries
        .filter((retry) => retry.phase === phase && retry.route === route)
        .reduce((sum, retry) => sum + retry.count, 0)
      const unretried = stats.networkErrors - retried
      if (unretried > 0) {
        const what =
          retried > 0
            ? `${unretried}× network error on ${route} (${phase}) not retried (${retried} retried)`
            : `${unretried}× network error on ${route} (${phase})`
        failures.push(
          `${what}, ${stats.timeouts} of them timeouts: ${JSON.stringify(stats.networkReasons)}`,
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

  const { settle, storm } = input
  if (settle && !settle.drain.drained) {
    const { inFlight, waiting, workersAlive, workersIdle } = settle.drain
    failures.push(
      `judge did not drain after the load: ${inFlight ?? '?'} in flight, ${waiting ?? '?'} waiting, ${workersAlive ?? '?'} worker(s) alive, ${workersIdle ?? '?'} idle`,
    )
  }
  const settleDivergence = settle ? consistencyFailure('after the load', settle.consistency) : null
  if (settleDivergence) failures.push(settleDivergence)

  if (storm) {
    if (storm.sse.failedToOpen > 0) {
      failures.push(
        `${storm.sse.failedToOpen} storm SSE connection(s) failed to open: ${JSON.stringify(storm.sse.failedToOpenBy)}`,
      )
    }
    if (storm.sse.dropped > 0) {
      failures.push(
        `${storm.sse.dropped} storm SSE connection(s) dropped: ${JSON.stringify(storm.sse.droppedBy)}`,
      )
    }
    if (storm.sse.invalidPayloads > 0) {
      failures.push(`${storm.sse.invalidPayloads} invalid SSE payload(s) in the storm`)
    }
    const stormDivergence = consistencyFailure('after the storm', storm.consistency)
    if (stormDivergence) failures.push(stormDivergence)
  }

  if (input.aborted) failures.push('run aborted before the end (SIGINT) — this report is partial')
  return failures
}

export function buildReport(input: ReportInput): LoadReport {
  const sse = summarizeSse(input.sse.requested, input.sse.connections)
  // The first read hands back the whole ring — up to two minutes from before
  // the run started. Those windows belong to no phase.
  const windows = mergeWindows(input.samples).filter((window) => window.endedAt >= input.startedAt)
  const timings = mergeTimings(input.samples)
  const spans = input.recorder.phases
  const settle = input.settle ?? null
  const storm = input.storm ? summarizeStorm(input.storm) : null
  const failures = buildFailures({
    recorder: input.recorder,
    sse,
    aborted: input.aborted,
    settle,
    storm,
  })
  const payloads = summarizePayloads([
    ...input.sse.connections,
    ...(input.storm?.connections ?? []),
  ])
  const rankingMax = payloads.find((payload) => payload.type === 'ranking.updated')?.maxBytes
  const harnessSamples = input.harnessSamples ?? []
  const harness = summarizeHarness(spans, harnessSamples, input.samples)
  const { organizerPassword: _password, ...config } = input.config
  return {
    scenario: input.config.scenario,
    runId: input.runId,
    target: input.config.url,
    // A saturated harness is a warning, never a failure (#442).
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    warnings: [...input.recorder.warnings, ...harnessWarnings(harness)],
    aborted: input.aborted,
    startedAt: new Date(input.startedAt).toISOString(),
    endedAt: new Date(input.endedAt).toISOString(),
    environment: input.environment,
    config,
    world: input.world,
    phases: summarizePhases(input.recorder.phases, input.samples, windows),
    harness,
    payloadCache: input.payloadCache ?? null,
    http: input.recorder.http,
    unexpected: input.recorder.unexpected,
    retries: input.recorder.retries,
    actions: input.recorder.actions,
    verdicts: input.recorder.verdicts,
    submissions: input.recorder.submissions,
    sse,
    judge: summarizeJudge(timings.judgeRuns, spans, input.samples),
    sseCost: {
      payloads,
      rankingBandwidthPerEmissionBytes:
        rankingMax === undefined || sse.opened === 0 ? null : rankingMax * sse.opened,
      emissions: summarizeEmissions(timings.emissions, spans),
      connects: summarizeConnects(timings.connects, spans),
    },
    settle,
    storm,
    timeline: {
      samples: input.samples.map(withoutRing),
      windows,
      harness: harnessSamples,
      ...timings,
    },
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
          ['problems in the round', String(world.problemIds.length)],
          ['past rounds', world.pastRounds.map((round) => round.name).join(', ') || dash],
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
  renderHarness(out, report.harness)

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

  out.push('## Retries')
  out.push('')
  if (report.retries.length === 0) {
    out.push('None.')
  } else {
    out.push(
      table(
        ['phase', 'route', 'after', 'count'],
        report.retries.map((retry) => [
          retry.phase,
          `\`${retry.route}\``,
          retry.reason,
          String(retry.count),
        ]),
      ),
    )
  }
  out.push('')
  out.push(
    'A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.',
  )
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

  const latency = Object.entries(report.submissions.latencyMs)
  if (latency.length > 0) {
    out.push('## Submissions by kind')
    out.push('')
    out.push(
      table(
        ['sent', 'count', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms'],
        latency.map(([kind, summary]) => [
          kind,
          String(summary?.count ?? 0),
          num(summary?.p50),
          num(summary?.p95),
          num(summary?.p99),
          num(summary?.max),
        ]),
      ),
    )
    out.push('')
    out.push('HTTP latency of the `POST /submissions` that answered 201, until its last byte.')
    out.push('')
  }

  if (report.judge) renderJudge(out, report.judge)

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
          'payloads validated (distinct / reused)',
          report.payloadCache
            ? `${report.payloadCache.distinct} / ${report.payloadCache.reused}`
            : dash,
        ],
        [
          'largest heartbeat gap per connection ms (p50 / p95 / p99 / max)',
          summaryCells(sse.maxHeartbeatGapMs).join(' / '),
        ],
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
  renderSseCost(out, report)
  if (report.settle) renderSettle(out, report.settle)
  if (report.storm) renderStorm(out, report.storm)
  return out.join('\n')
}

function renderHarness(out: string[], harness: HarnessPhaseSummary[]) {
  out.push('## Phases (harness process)')
  out.push('')
  out.push(
    table(
      [
        'phase',
        'CPU % mean',
        'CPU % max',
        'ELU mean',
        'ELU max',
        'lag p99 ms',
        'lag max ms',
        'largest poll gap ms',
        'samples',
        'saturated',
      ],
      harness.map((phase) => [
        phase.phase,
        num(phase.cpuPercent.mean),
        num(phase.cpuPercent.max),
        num(phase.elu.mean, 3),
        num(phase.elu.max, 3),
        num(phase.lag.p99OfWindowP99Ms),
        num(phase.lag.maxMs),
        num(phase.maxPollGapMs, 0),
        String(phase.samples),
        phase.saturated ? 'yes' : dash,
      ]),
    ),
  )
  out.push('')
  out.push(
    `The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per \`--sample-interval\` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ ${HARNESS_SATURATED_ELU} or a lag ≥ ${HARNESS_STALL_MS} ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.`,
  )
  out.push('')
}

function summaryCells(summary: Summary): string[] {
  return [summary.p50, summary.p95, summary.p99, summary.max].map((value) => num(value))
}

function renderJudge(out: string[], judge: JudgeReport) {
  out.push('## Judge (load phase)')
  out.push('')
  out.push(
    table(
      ['field', 'value'],
      [
        ['runs that arrived during the load', String(judge.runs)],
        [
          'by outcome',
          Object.entries(judge.byOutcome)
            .map(([outcome, count]) => `${outcome}×${count}`)
            .join(', ') || dash,
        ],
        ['largest queue at an arrival (itself included)', num(judge.waitingAtArrivalMax, 0)],
        [
          'spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max)',
          [judge.spawnShareOfPassed.p50, judge.spawnShareOfPassed.p95, judge.spawnShareOfPassed.max]
            .map((value) => num(value, 2))
            .join(' / '),
        ],
        [
          'workers spawned / exited / alive / idle at the end',
          judge.workers
            ? `${judge.workers.spawned} / ${judge.workers.exited} / ${judge.workers.alive} / ${judge.workers.idle}`
            : dash,
        ],
        [
          'judge config (concurrency · timeout ms · memory MB)',
          judge.config
            ? `${judge.config.concurrency} · ${judge.config.timeoutMs} · ${judge.config.memoryMb}`
            : dash,
        ],
      ],
    ),
  )
  out.push('')
  const rows: string[][] = []
  const stageRows = (label: string, stages: JudgeStageSummary) => {
    for (const [stage, summary] of [
      ['queue', stages.queueMs],
      ['spawn', stages.spawnMs],
      ['exec', stages.execMs],
      ['total', stages.totalMs],
    ] as const) {
      rows.push([label, stage, String(summary.count), ...summaryCells(summary)])
    }
  }
  stageRows('all', judge.all)
  for (const [outcome, stages] of Object.entries(judge.byOutcomeTimings)) {
    if (stages) stageRows(outcome, stages)
  }
  out.push(table(['outcome', 'stage', 'count', 'p50 ms', 'p95 ms', 'p99 ms', 'max ms'], rows))
  out.push('')
  out.push(
    'queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.',
  )
  out.push('')
  out.push('### First wave')
  out.push('')
  if (judge.firstWave.points.length === 0) {
    out.push('Fewer than 10 runs: no curve.')
  } else {
    out.push(
      table(
        ['k-th arrival', 'its queue wait ms', 'p95 queue wait of the first k ms'],
        judge.firstWave.points.map((point) => [
          String(point.k),
          num(point.kthQueueMs),
          num(point.p95QueueMs),
        ]),
      ),
    )
  }
  out.push('')
  out.push(
    `First k whose p95 queue wait passes ${judge.firstWave.thresholdMs} ms: ${judge.firstWave.firstKAboveThreshold ?? 'none'}.`,
  )
  out.push('')
}

function renderSseCost(out: string[], report: LoadReport) {
  const cost = report.sseCost
  if (cost.payloads.length > 0) {
    out.push('### Payloads')
    out.push('')
    out.push(
      table(
        ['event', 'events', 'min bytes', 'mean bytes', 'max bytes'],
        cost.payloads.map((payload) => [
          payload.type,
          String(payload.events),
          String(payload.minBytes),
          num(payload.meanBytes, 0),
          String(payload.maxBytes),
        ]),
      ),
    )
    out.push('')
    out.push(
      `Largest \`ranking.updated\` × connections opened: ${cost.rankingBandwidthPerEmissionBytes === null ? dash : `${(cost.rankingBandwidthPerEmissionBytes / 1024 / 1024).toFixed(2)} MiB`} per emission. Bytes are the \`data:\` line, UTF-8.`,
    )
    out.push('')
  }
  if (cost.emissions.length > 0) {
    out.push('### Emissions (back)')
    out.push('')
    out.push(
      table(
        [
          'phase',
          'kind',
          'count',
          'subscribers max',
          'publish ms p50 / p95 / max',
          'open round ms p50 / p95 / max',
          'round ranking ms p50 / p95 / max',
          'event ranking ms p50 / p95 / max',
        ],
        cost.emissions.map((emission) => {
          const cells = (summary: Summary) =>
            [summary.p50, summary.p95, summary.max].map((value) => num(value, 2)).join(' / ')
          return [
            emission.phase,
            emission.kind,
            String(emission.count),
            num(emission.subscribersMax, 0),
            cells(emission.publishMs),
            cells(emission.openRoundMs),
            cells(emission.roundRankingMs),
            cells(emission.eventRankingMs),
          ]
        }),
      ),
    )
    out.push('')
    out.push(
      'publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.',
    )
    out.push('')
  }
  if (cost.connects.length > 0) {
    out.push('### Connects (back)')
    out.push('')
    out.push(
      table(
        ['phase', 'count', 'state.sync ms', 'ranking ms', 'total ms', 'concurrent max'],
        cost.connects.map((connect) => {
          const cells = (summary: Summary) =>
            [summary.p50, summary.p95, summary.p99, summary.max]
              .map((value) => num(value))
              .join(' / ')
          return [
            connect.phase,
            String(connect.count),
            cells(connect.stateSyncMs),
            cells(connect.rankingMs),
            cells(connect.totalMs),
            num(connect.concurrentMax, 0),
          ]
        }),
      ),
    )
    out.push('')
    out.push(
      'p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.',
    )
    out.push('')
  }
}

function consistencyRow(check: ConsistencyCheck): string {
  const verdict =
    check.matchesApi === null
      ? 'nothing to compare'
      : check.matchesApi
        ? 'matches the API'
        : 'DIVERGES'
  return `${check.compared} compared, ${check.withoutRanking} without a ranking, ${check.distinctDigests} distinct digest(s): ${verdict} (after ${num(check.waitedMs, 0)} ms)`
}

function renderSettle(out: string[], settle: SettleReport) {
  out.push('## Settle')
  out.push('')
  const { drain } = settle
  out.push(
    table(
      ['check', 'result'],
      [
        [
          'judge drained',
          `${drain.drained ? 'yes' : 'NO'} after ${num(drain.waitedMs, 0)} ms (in flight ${drain.inFlight ?? dash}, waiting ${drain.waiting ?? dash}, workers alive ${drain.workersAlive ?? dash}, idle ${drain.workersIdle ?? dash})`,
        ],
        ['ranking consistency', consistencyRow(settle.consistency)],
      ],
    ),
  )
  out.push('')
}

function renderStorm(out: string[], storm: StormReport) {
  out.push('## Storm')
  out.push('')
  out.push(
    table(
      ['field', 'value'],
      [
        ['reopened', `${storm.requested} over ${storm.windowSeconds} s`],
        ['opened', String(storm.sse.opened)],
        [
          'failed to open',
          `${storm.sse.failedToOpen}${storm.sse.failedToOpen ? ` ${JSON.stringify(storm.sse.failedToOpenBy)}` : ''}`,
        ],
        [
          'dropped',
          `${storm.sse.dropped}${storm.sse.dropped ? ` ${JSON.stringify(storm.sse.droppedBy)}` : ''}`,
        ],
        ['to headers ms (p50 / p95 / p99 / max)', summaryCells(storm.headersMs).join(' / ')],
        [
          'to the first state.sync ms (p50 / p95 / p99 / max)',
          summaryCells(storm.firstStateSyncMs).join(' / '),
        ],
        [
          'to the first ranking.updated ms (p50 / p95 / p99 / max)',
          summaryCells(storm.firstRankingMs).join(' / '),
        ],
        ['ranking consistency', consistencyRow(storm.consistency)],
      ],
    ),
  )
  out.push('')
}

/** Writes report.md and report.json into `dir`, creating it. */
export async function writeReport(report: LoadReport, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(join(dir, 'report.md'), `${renderMarkdown(report)}\n`)
  return dir
}
