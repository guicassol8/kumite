import { describe, expect, it } from 'vitest'

import type { JudgeRun } from '../modules/judge/judge.schema'
import type { ProcessStats } from '../modules/stats/stats.schema'

import {
  type BackSample,
  cpuPercent,
  mergeTimings,
  mergeWindows,
  startBackSampler,
} from './back-sampler'
import { emptyTimings } from './fixtures'
import { createRecorder } from './recorder'
import { createTransport } from './transport'

function processStats(
  sampledAt: number,
  userMicros: number,
  systemMicros: number,
  windowEnds: number[] = [],
): ProcessStats {
  return {
    sampledAt,
    uptimeSeconds: 10,
    cpu: { userMicros, systemMicros },
    memory: { rss: 100, heapUsed: 50, heapTotal: 80, external: 5 },
    eventLoop: {
      windowMs: 1000,
      windows: windowEnds.map((endedAt) => ({
        endedAt,
        durationMs: 1000,
        delayP50Ms: 1,
        delayP99Ms: 2,
        delayMaxMs: 3,
        utilization: 0.1,
      })),
    },
    ...emptyTimings(),
  }
}

function sample(process: ProcessStats | null): BackSample {
  return { at: process?.sampledAt ?? 0, phase: 'rest', process, live: null }
}

describe('cpuPercent', () => {
  it('is the cpu time used over the wall time between two reads, in % of one core', () => {
    // 500 ms of user + 250 ms of system over 1 s = 75% of a core.
    const prev = processStats(1_000, 1_000_000, 500_000)
    const next = processStats(2_000, 1_500_000, 750_000)
    expect(cpuPercent(prev, next)).toBe(75)
  })

  it('can pass 100 when several threads are busy', () => {
    expect(cpuPercent(processStats(0, 0, 0), processStats(1_000, 1_800_000, 200_000))).toBe(200)
  })

  it('is null when the reads are not ordered in time', () => {
    expect(cpuPercent(processStats(1_000, 0, 0), processStats(1_000, 10, 0))).toBeNull()
  })
})

describe('mergeWindows', () => {
  it('keeps each window once, keyed by endedAt, oldest first', () => {
    const samples = [
      sample(processStats(1, 0, 0, [100, 200, 300])),
      sample(null),
      sample(processStats(2, 0, 0, [200, 300, 400])),
      sample(processStats(3, 0, 0, [400, 500])),
    ]
    expect(mergeWindows(samples).map((window) => window.endedAt)).toEqual([100, 200, 300, 400, 500])
  })
})

function run(seq: number): JudgeRun {
  return {
    seq,
    arrivedAt: seq,
    endedAt: seq + 1,
    waitingAtArrival: 0,
    queueMs: 0,
    spawnMs: 1,
    execMs: 1,
    caseMs: 1,
    cases: 5,
    outcome: 'passed',
  }
}

function withRuns(sampledAt: number, seqs: number[]): ProcessStats {
  const stats = processStats(sampledAt, 0, 0)
  return { ...stats, judge: { ...stats.judge, runs: seqs.map(run) } }
}

describe('mergeTimings', () => {
  it('keeps each judge run, emission and connect once across overlapping polls, by seq', () => {
    const emission = (seq: number) => ({
      seq,
      endedAt: seq,
      kind: 'heartbeat' as const,
      subscribers: 1,
      publishMs: 0,
      stages: null,
    })
    const first = withRuns(1, [1, 2, 3])
    const second = withRuns(2, [3, 4])
    second.sse.emissions = [emission(7), emission(8)]
    const third = withRuns(3, [4, 5])
    third.sse.emissions = [emission(8)]

    const merged = mergeTimings([sample(first), sample(null), sample(second), sample(third)])

    expect(merged.judgeRuns.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5])
    expect(merged.emissions.map((entry) => entry.seq)).toEqual([7, 8])
    expect(merged.connects).toEqual([])
  })
})

describe('startBackSampler', () => {
  it('asks each poll only for what ended since the previous one answered', async () => {
    const urls: string[] = []
    let sampledAt = 1_000
    const recorder = createRecorder()
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 5_000,
      fetch: async (input) => {
        const url = new URL(input)
        if (url.pathname === '/organizer/stats/process') {
          urls.push(url.search)
          sampledAt += 1_000
          return Response.json(processStats(sampledAt, 0, 0))
        }
        return Response.json({ error: 'not_found' }, { status: 404 })
      },
    })

    const sampler = startBackSampler({ transport, recorder, organizerToken: 't', intervalMs: 1 })
    await new Promise((resolve) => setTimeout(resolve, 50))
    await sampler.stop()

    expect(urls[0]).toBe('')
    expect(urls.length).toBeGreaterThan(2)
    for (let i = 1; i < urls.length; i++) {
      expect(urls[i]).toBe(`?since=${1_000 + i * 1_000}`)
    }
  })
})
