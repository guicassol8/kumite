import { describe, expect, it } from 'vitest'

import type { ProcessStats } from '../modules/stats/stats.schema'

import { type BackSample, cpuPercent, mergeWindows } from './back-sampler'
import { emptyTimings } from './fixtures'

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
