import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { BackSample } from './back-sampler'
import { PRESETS } from './config'
import { emptyTimings } from './fixtures'
import { createRecorder, type RecorderSnapshot } from './recorder'
import {
  buildFailures,
  buildReport,
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
      '2× network error on POST /submissions (load), 1 of them timeouts',
    ])
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
