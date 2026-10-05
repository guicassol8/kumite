import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import type { JudgeRun } from '../modules/judge/judge.schema'
import type { BackSample } from './back-sampler'
import { PRESETS } from './config'
import { emptyTimings } from './fixtures'
import { createRecorder, type RecorderSnapshot } from './recorder'

import {
  buildFailures,
  buildReport,
  firstWaveCurve,
  type ReportInput,
  renderMarkdown,
  summarizePhases,
  summarizeSse,
  writeReport,
} from './report'
import type { SseConnectionReport } from './sse-client'

function connection(overrides: Partial<SseConnectionReport> = {}): SseConnectionReport {
  return {
    state: 'closed',
    failure: null,
    dropReason: null,
    events: { 'state.sync': 1, 'ranking.updated': 1, heartbeat: 10 },
    heartbeatIntervalsMs: [1000, 1001],
    maxHeartbeatGapMs: 1001,
    bytes: {
      'state.sync': { count: 1, total: 100, min: 100, max: 100 },
      'ranking.updated': { count: 1, total: 2000, min: 2000, max: 2000 },
      heartbeat: { count: 10, total: 600, min: 60, max: 60 },
    },
    headersMs: 5,
    firstEventMs: { 'state.sync': 6, 'ranking.updated': 9, heartbeat: 900 },
    lastRankingDigest: 'digest-a',
    invalidPayloads: 0,
    invalidSamples: [],
    ...overrides,
  }
}

function cleanRecorder(): RecorderSnapshot {
  let clock = 0
  const recorder = createRecorder({ clock: () => clock })
  recorder.setPhase('setup')
  recorder.recordHttp({ method: 'POST', url: '/auth/login', status: 200, errorCode: null, ms: 12 })
  recorder.actionStarted('signup')
  recorder.actionCompleted('signup')
  recorder.setPhase('load')
  recorder.recordHttp({
    method: 'POST',
    url: '/submissions',
    status: 429,
    errorCode: 'submission_throttled',
    ms: 3,
  })
  recorder.recordHttp({ method: 'POST', url: '/submissions', status: 201, errorCode: null, ms: 80 })
  recorder.actionStarted('submission')
  recorder.actionCompleted('submission')
  recorder.recordVerdict('correct', 'accepted')
  recorder.recordSubmissionLatency('correct', 80)
  clock = 10_000
  recorder.endPhases()
  return recorder.snapshot()
}

const cleanSse = () => summarizeSse(2, [connection(), connection()])

describe('buildFailures', () => {
  it('is empty on a clean run, 429s included', () => {
    expect(buildFailures({ recorder: cleanRecorder(), sse: cleanSse(), aborted: false })).toEqual(
      [],
    )
  })

  it('flags a 5xx', () => {
    const recorder = cleanRecorder()
    const stats = recorder.http.load?.['POST /submissions']
    if (!stats) throw new Error('fixture')
    stats.byStatus['500:internal'] = 1
    const failures = buildFailures({ recorder, sse: cleanSse(), aborted: false })
    expect(failures).toEqual(['1× 500:internal on POST /submissions (load)'])
  })

  it('flags a network error, counting the timeouts', () => {
    const recorder = cleanRecorder()
    const stats = recorder.http.load?.['POST /submissions']
    if (!stats) throw new Error('fixture')
    stats.networkErrors = 2
    stats.timeouts = 1
    expect(buildFailures({ recorder, sse: cleanSse(), aborted: false })).toEqual([
      '2× network error on POST /submissions (load), 1 of them timeouts: {}',
    ])
  })

  it('does not flag a network error the harness retried, and flags the rest (#138)', () => {
    const recorder = cleanRecorder()
    const stats = recorder.http.load?.['POST /submissions']
    if (!stats) throw new Error('fixture')
    stats.networkErrors = 3
    stats.networkReasons = { 'UND_ERR_SOCKET · request · reused': 3 }
    recorder.retries.push({
      phase: 'load',
      route: 'POST /submissions',
      reason: 'UND_ERR_SOCKET · request · reused',
      count: 2,
    })
    expect(buildFailures({ recorder, sse: cleanSse(), aborted: false })).toEqual([
      '1× network error on POST /submissions (load) not retried (2 retried), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":3}',
    ])
    recorder.retries[0] = {
      ...(recorder.retries[0] as (typeof recorder.retries)[number]),
      count: 3,
    }
    expect(buildFailures({ recorder, sse: cleanSse(), aborted: false })).toEqual([])
  })

  it('flags an unexpected status', () => {
    const recorder = cleanRecorder()
    recorder.unexpected.push({
      phase: 'setup',
      route: 'POST /teams',
      status: 409,
      errorCode: 'name_taken',
      count: 1,
    })
    expect(buildFailures({ recorder, sse: cleanSse(), aborted: false })).toEqual([
      '1× unexpected 409:name_taken on POST /teams (setup)',
    ])
  })

  it('flags an action started and never completed', () => {
    const recorder = cleanRecorder()
    recorder.actions['submission'] = { started: 3, completed: 2 }
    expect(buildFailures({ recorder, sse: cleanSse(), aborted: false })).toEqual([
      'submission: 3 started, 2 completed (1 never finished)',
    ])
  })

  it('flags an incoherent verdict', () => {
    const recorder = cleanRecorder()
    recorder.verdicts.incoherent = 1
    const failures = buildFailures({ recorder, sse: cleanSse(), aborted: false })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatch(/^1 incoherent verdict/)
  })

  it('flags an SSE connection that failed to open, one that dropped, and an invalid payload', () => {
    const sse = summarizeSse(3, [
      connection({
        state: 'failed',
        failure: { status: 401, errorCode: 'unauthorized', reason: 'HTTP 401' },
        events: {},
      }),
      connection({ state: 'dropped', dropReason: 'session.revoked' }),
      connection({ invalidPayloads: 1, invalidSamples: ['nope'] }),
    ])
    expect(buildFailures({ recorder: cleanRecorder(), sse, aborted: false })).toEqual([
      '1 SSE connection(s) failed to open: {"401:unauthorized":1}',
      '1 SSE connection(s) dropped: {"session.revoked":1}',
      '1 invalid SSE payload(s)',
    ])
  })

  it('flags a setup error and an abort', () => {
    const recorder = cleanRecorder()
    recorder.errors.push({ phase: 'setup', message: 'another round is open: "Rodada 1"' })
    expect(buildFailures({ recorder, sse: cleanSse(), aborted: true })).toEqual([
      'setup failed: another round is open: "Rodada 1"',
      'run aborted before the end (SIGINT) — this report is partial',
    ])
  })
})

describe('summarizeSse', () => {
  it('reports events per opened connection and the heartbeat gaps', () => {
    const sse = summarizeSse(3, [
      connection({ events: { heartbeat: 4 } }),
      connection({ events: { heartbeat: 6, 'state.sync': 1 }, heartbeatIntervalsMs: [990] }),
      connection({
        state: 'failed',
        events: {},
        heartbeatIntervalsMs: [],
        failure: { status: null, errorCode: null, reason: 'ECONNREFUSED' },
      }),
    ])
    expect(sse.opened).toBe(2)
    expect(sse.failedToOpenBy).toEqual({ ECONNREFUSED: 1 })
    expect(sse.eventsPerConnection).toEqual({
      heartbeat: { min: 4, mean: 5, max: 6 },
      'state.sync': { min: 0, mean: 0.5, max: 1 },
    })
    expect(sse.heartbeatIntervalMs.count).toBe(3)
    expect(sse.heartbeatIntervalMs.max).toBe(1001)
  })
})

describe('summarizePhases', () => {
  it('cuts CPU, memory, lag and the live counters by phase', () => {
    const at = (t: number, cpuMicros: number, rss: number, waiting: number): BackSample => ({
      at: t,
      phase: 'rest',
      process: {
        sampledAt: t,
        uptimeSeconds: t / 1000,
        cpu: { userMicros: cpuMicros, systemMicros: 0 },
        memory: { rss, heapUsed: rss / 2, heapTotal: rss, external: 0 },
        eventLoop: { windowMs: 1000, windows: [] },
        ...emptyTimings(),
      },
      live: {
        judge: { inFlight: 0, waiting, concurrency: 4 },
        sse: { connections: waiting * 10 },
        submissions: { inFlight: 0, lastMinute: 0, perMinute: Array(15).fill(0) },
      },
    })
    const samples = [at(0, 0, 100, 0), at(1000, 100_000, 120, 1), at(2000, 600_000, 300, 3)]
    const windows = [
      {
        endedAt: 900,
        durationMs: 1000,
        delayP50Ms: 1,
        delayP99Ms: 2,
        delayMaxMs: 4,
        utilization: 0.2,
      },
      {
        endedAt: 1900,
        durationMs: 1000,
        delayP50Ms: 5,
        delayP99Ms: 30,
        delayMaxMs: 50,
        utilization: 0.6,
      },
    ]
    const [rest, load] = summarizePhases(
      [
        { phase: 'rest', startedAt: 0, endedAt: 1000 },
        { phase: 'load', startedAt: 1001, endedAt: 2000 },
      ],
      samples,
      windows,
    )

    expect(rest).toMatchObject({
      phase: 'rest',
      durationSeconds: 1,
      cpuPercent: { mean: 10, max: 10 },
      rssMaxBytes: 120,
      lag: { p99OfWindowP99Ms: 2, maxMs: 4 },
      eluMean: 0.2,
      judgeWaitingMax: 1,
      sseConnectionsMax: 10,
      samples: 2,
    })
    expect(load).toMatchObject({
      phase: 'load',
      cpuPercent: { mean: 50, max: 50 },
      rssMaxBytes: 300,
      lag: { p99OfWindowP99Ms: 30, maxMs: 50 },
      judgeWaitingMax: 3,
    })
  })
})

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    config: {
      ...PRESETS.smoke,
      scenario: 'smoke',
      url: 'http://localhost:3000',
      out: '/tmp',
      allowRemote: false,
      organizerEmail: 'org@edu.pucrs.br',
      organizerPassword: 'do-not-print-me',
    },
    runId: 'abc',
    startedAt: 0,
    endedAt: 10_000,
    aborted: false,
    environment: {
      node: 'v24',
      commit: 'deadbee',
      loadavgStart: [0.5, 0.4, 0.3],
      loadavgEnd: [0.6, 0.5, 0.4],
      parallelism: 8,
    },
    recorder: cleanRecorder(),
    world: {
      teams: 1,
      participants: 1,
      membersPerTeam: 1,
      maxTeamSize: 3,
      before: { participants: 0, teams: 0 },
      round: { id: 'r', name: 'load-abc' },
      problemId: 'p',
      problemIds: ['p'],
      pastRounds: [],
      closedLeftoverRounds: [],
    },
    sse: { requested: 2, connections: [connection(), connection()] },
    samples: [],
    ...overrides,
  }
}

describe('buildReport + renderMarkdown', () => {
  it('passes a clean run and renders every section, without the organizer password', () => {
    const report = buildReport(input())
    const markdown = renderMarkdown(report)

    expect(report.status).toBe('PASS')
    expect(JSON.stringify(report)).not.toContain('do-not-print-me')
    expect(markdown).toContain('**PASS**')
    for (const section of [
      '## Run',
      '## Config',
      '## World',
      '## Phases (back process)',
      '## HTTP by route',
      '## Verdicts',
      '## Actions',
      '## SSE',
    ]) {
      expect(markdown).toContain(section)
    }
    expect(markdown).toContain('0.50 / 0.40 / 0.30')
    expect(markdown).toContain('`POST /submissions`')
    expect(markdown).not.toContain('## Failures')
  })

  it('fails a run with failures and lists them first', () => {
    const recorder = cleanRecorder()
    recorder.errors.push({ phase: 'setup', message: 'boom' })
    const report = buildReport(input({ recorder, world: null, aborted: true }))
    const markdown = renderMarkdown(report)

    expect(report.status).toBe('FAIL')
    expect(markdown).toContain('**FAIL** (aborted, partial)')
    expect(markdown).toContain('## Failures\n\n- setup failed: boom')
    expect(markdown).toContain('Setup did not complete.')
  })

  it('writes report.md and report.json', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'load-report-')), 'smoke-abc')
    await writeReport(buildReport(input()), dir)

    expect(JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')).status).toBe('PASS')
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toContain('# Load report: smoke `abc`')
  })
})

describe('buildReport timeline', () => {
  it('keeps each window once and drops the per-sample copies of the ring', () => {
    const window = (endedAt: number) => ({
      endedAt,
      durationMs: 1000,
      delayP50Ms: 1,
      delayP99Ms: 2,
      delayMaxMs: 3,
      utilization: 0.1,
    })
    const sampleAt = (at: number, ends: number[]): BackSample => ({
      at,
      phase: 'rest',
      process: {
        sampledAt: at,
        uptimeSeconds: 1,
        cpu: { userMicros: 0, systemMicros: 0 },
        memory: { rss: 1, heapUsed: 1, heapTotal: 1, external: 0 },
        eventLoop: { windowMs: 1000, windows: ends.map(window) },
        ...emptyTimings(),
      },
      live: null,
    })
    // The run starts at 0: the window that closed at -500 belongs to no phase.
    const samples = [sampleAt(1000, [-500, 500, 1000]), sampleAt(2000, [1000, 2000])]

    const { timeline } = buildReport(input({ samples }))

    expect(timeline.windows.map((w) => w.endedAt)).toEqual([500, 1000, 2000])
    expect(timeline.samples.map((s) => s.process?.eventLoop.windows)).toEqual([[], []])
    expect(timeline.samples.map((s) => s.at)).toEqual([1000, 2000])
  })
})

// --- #137/#138 ---

const consistent = {
  compared: 2,
  withoutRanking: 0,
  distinctDigests: 1,
  matchesApi: true,
  apiDigest: 'digest-a',
  waitedMs: 10,
}
const drained = {
  drained: true,
  waitedMs: 5,
  inFlight: 0,
  waiting: 0,
  workersAlive: 2,
  workersIdle: 2,
}

function judgeRun(seq: number, overrides: Partial<JudgeRun> = {}): JudgeRun {
  return {
    seq,
    arrivedAt: 1_000 + seq,
    endedAt: 2_000 + seq,
    waitingAtArrival: 0,
    queueMs: 0,
    spawnMs: 40,
    execMs: 60,
    caseMs: 50,
    cases: 5,
    outcome: 'passed',
    ...overrides,
  }
}

describe('buildFailures (#137, #138)', () => {
  const base = () => ({ recorder: cleanRecorder(), sse: cleanSse(), aborted: false })

  it('stays empty after a clean settle and a clean storm', () => {
    const storm = buildReport(
      input({
        storm: {
          requested: 2,
          windowSeconds: 0,
          connections: [connection(), connection()],
          consistency: consistent,
        },
      }),
    ).storm
    expect(
      buildFailures({ ...base(), settle: { drain: drained, consistency: consistent }, storm }),
    ).toEqual([])
  })

  it('flags a judge that did not drain, or a busy worker left alive', () => {
    const failures = buildFailures({
      ...base(),
      settle: {
        drain: { ...drained, drained: false, inFlight: 1, workersAlive: 3, workersIdle: 2 },
        consistency: consistent,
      },
    })
    expect(failures).toEqual([
      'judge did not drain after the load: 1 in flight, 0 waiting, 3 worker(s) alive, 2 idle',
    ])
  })

  it('flags a ranking that differs between connections or from the API, at settle and after the storm', () => {
    const diverged = { ...consistent, distinctDigests: 2, matchesApi: false }
    const storm = buildReport(
      input({
        storm: {
          requested: 1,
          windowSeconds: 0,
          connections: [connection()],
          consistency: { ...consistent, compared: 1, withoutRanking: 1, matchesApi: false },
        },
      }),
    ).storm
    const failures = buildFailures({
      ...base(),
      settle: { drain: drained, consistency: diverged },
      storm,
    })
    expect(failures).toEqual([
      'SSE ranking diverged after the load: 2 connection(s) compared, 0 without a ranking, 2 distinct digest(s), API digest not matched',
      'SSE ranking diverged after the storm: 1 connection(s) compared, 1 without a ranking, 1 distinct digest(s), API digest not matched',
    ])
  })

  it('flags a storm connection that failed to open or dropped', () => {
    const storm = buildReport(
      input({
        storm: {
          requested: 2,
          windowSeconds: 2,
          connections: [
            connection({
              state: 'failed',
              failure: { status: null, errorCode: null, reason: 'timeout' },
            }),
            connection({ state: 'dropped', dropReason: 'stream_ended' }),
          ],
          consistency: { ...consistent, compared: 0, matchesApi: null },
        },
      }),
    ).storm
    expect(buildFailures({ ...base(), storm })).toEqual([
      '1 storm SSE connection(s) failed to open: {"timeout":1}',
      '1 storm SSE connection(s) dropped: {"stream_ended":1}',
    ])
  })
})

describe('firstWaveCurve', () => {
  it('reads the k-th arrival’s wait and the p95 of the first k, and where it passes the threshold', () => {
    // 100 arrivals, the i-th (1-based) waiting 100·i ms. The p95 of the
    // first k is the ceil(0.95·k)-th wait: k = 53 is the first where that is
    // the 51st arrival, 5100 ms.
    const runs = Array.from({ length: 100 }, (_, i) =>
      judgeRun(100 - i, { arrivedAt: i, queueMs: (i + 1) * 100 }),
    )
    const curve = firstWaveCurve(runs)

    expect(curve.points).toEqual([
      { k: 10, kthQueueMs: 1_000, p95QueueMs: 1_000 },
      { k: 25, kthQueueMs: 2_500, p95QueueMs: 2_400 },
      { k: 50, kthQueueMs: 5_000, p95QueueMs: 4_800 },
      { k: 75, kthQueueMs: 7_500, p95QueueMs: 7_200 },
      { k: 100, kthQueueMs: 10_000, p95QueueMs: 9_500 },
    ])
    expect(curve.firstKAboveThreshold).toBe(53)
  })

  it('has no point beyond the runs it has, and no threshold crossing when nothing waits', () => {
    const curve = firstWaveCurve(Array.from({ length: 12 }, (_, i) => judgeRun(i + 1)))
    expect(curve.points.map((point) => point.k)).toEqual([10])
    expect(curve.firstKAboveThreshold).toBeNull()
  })
})

describe('buildReport judge and SSE cost sections', () => {
  function processSample(at: number, runs: JudgeRun[]): BackSample {
    const timings = emptyTimings()
    return {
      at,
      phase: 'load',
      process: {
        sampledAt: at,
        uptimeSeconds: 1,
        cpu: { userMicros: 0, systemMicros: 0 },
        memory: { rss: 1, heapUsed: 1, heapTotal: 1, external: 0 },
        eventLoop: { windowMs: 1000, windows: [] },
        judge: { ...timings.judge, runs, workers: { spawned: 3, exited: 1, alive: 2, idle: 2 } },
        sse: {
          emissions: [
            {
              seq: 1,
              endedAt: at,
              kind: 'ranking',
              subscribers: 2,
              publishMs: 0.5,
              stages: { openRoundMs: 1, roundRankingMs: 2, eventRankingMs: 3 },
            },
          ],
          connects: [],
        },
      },
      live: null,
    }
  }

  it('summarizes the load phase’s runs by outcome, the payloads and the emissions, and renders them', () => {
    // cleanRecorder's load phase spans [0, 10 000].
    const runs = [
      judgeRun(1, { arrivedAt: 100 }),
      judgeRun(2, { arrivedAt: 200, outcome: 'timeout', spawnMs: null }),
      judgeRun(3, { arrivedAt: 300, outcome: 'runtime_error' }),
    ]
    const report = buildReport(
      input({
        samples: [processSample(5_000, runs.slice(0, 2)), processSample(6_000, runs.slice(1))],
        settle: { drain: drained, consistency: consistent },
      }),
    )

    expect(report.judge).toMatchObject({
      runs: 3,
      byOutcome: { passed: 1, timeout: 1, runtime_error: 1 },
      workers: { spawned: 3, exited: 1, alive: 2, idle: 2 },
    })
    expect(report.judge?.spawnShareOfPassed.p50).toBe(0.4)
    expect(report.sseCost.payloads.find((p) => p.type === 'ranking.updated')).toEqual({
      type: 'ranking.updated',
      events: 2,
      minBytes: 2000,
      meanBytes: 2000,
      maxBytes: 2000,
    })
    expect(report.sseCost.rankingBandwidthPerEmissionBytes).toBe(4000)
    expect(report.sseCost.emissions).toMatchObject([
      { phase: 'load', kind: 'ranking', count: 1, subscribersMax: 2 },
    ])
    expect(report.timeline.judgeRuns.map((run) => run.seq)).toEqual([1, 2, 3])
    expect(report.timeline.samples.every((sample) => sample.process?.judge.runs.length === 0)).toBe(
      true,
    )

    const markdown = renderMarkdown(report)
    for (const section of [
      '## Submissions by kind',
      '## Judge (load phase)',
      '### First wave',
      '### Payloads',
      '### Emissions (back)',
      '## Settle',
    ]) {
      expect(markdown).toContain(section)
    }
  })
})
