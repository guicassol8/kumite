import { afterEach, describe, expect, it, vi } from 'vitest'

import { type HarnessReading, harnessWindow, startHarnessSampler } from './harness-sampler'
import type { Phase } from './recorder'

// Timing rule (#431): every reading is fabricated and the timers are fake —
// nothing here measures a real duration.

function reading(at: number, cpuMicros: number, idle: number, active: number): HarnessReading {
  return { at, cpuMicros, elu: { idle, active } }
}

describe('harnessWindow', () => {
  it('is the CPU % of one core and the share of the loop that was busy', () => {
    // 900 ms of CPU over 1 s, the loop active 950 ms and idle 50 ms.
    const window = harnessWindow(reading(1_000, 0, 0, 0), reading(2_000, 900_000, 50, 950))
    expect(window.cpuPercent).toBe(90)
    expect(window.elu).toBe(0.95)
  })

  it('uses the time really elapsed: a late timer does not inflate the numbers', () => {
    // A 1 s timer that fired after 4 s, with one core busy throughout.
    const window = harnessWindow(reading(0, 0, 0, 0), reading(4_000, 4_000_000, 0, 4_000))
    expect(window).toEqual({ cpuPercent: 100, elu: 1 })
  })

  it('is null when the reads are not ordered in time', () => {
    expect(harnessWindow(reading(2_000, 10, 5, 5), reading(2_000, 20, 6, 6))).toEqual({
      cpuPercent: null,
      elu: null,
    })
    expect(harnessWindow(reading(2_000, 10, 5, 5), reading(1_000, 20, 6, 6))).toEqual({
      cpuPercent: null,
      elu: null,
    })
  })
})

describe('startHarnessSampler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('records one sample per interval, tagged with the phase at the time, and one on stop', () => {
    vi.useFakeTimers()
    const reads = [
      reading(0, 0, 0, 0),
      reading(1_000, 500_000, 500, 500),
      reading(2_000, 1_500_000, 500, 1_500),
      reading(2_500, 1_500_000, 1_000, 1_500),
    ]
    let next = 0
    const read = () => reads[next++] ?? reading(9_999, 0, 0, 0)
    const lags = [
      { p99Ms: 12, maxMs: 15 },
      { p99Ms: 900, maxMs: 1_200 },
      { p99Ms: null, maxMs: null },
    ]
    let lagNext = 0
    let stopped = false
    const lag = () => ({
      take: () => lags[lagNext++] ?? { p99Ms: null, maxMs: null },
      stop: () => {
        stopped = true
      },
    })
    let phase: Phase = 'rest'

    const sampler = startHarnessSampler({
      recorder: { phase: () => phase },
      intervalMs: 1_000,
      read,
      lag,
    })
    vi.advanceTimersByTime(1_000)
    phase = 'load'
    vi.advanceTimersByTime(1_000)
    expect(sampler.samples()).toHaveLength(2)
    const samples = sampler.stop()

    expect(samples).toEqual([
      { at: 1_000, phase: 'rest', cpuPercent: 50, elu: 0.5, lagP99Ms: 12, lagMaxMs: 15 },
      { at: 2_000, phase: 'load', cpuPercent: 100, elu: 1, lagP99Ms: 900, lagMaxMs: 1_200 },
      { at: 2_500, phase: 'load', cpuPercent: 0, elu: 0, lagP99Ms: null, lagMaxMs: null },
    ])
    expect(stopped).toBe(true)
    // Stopped: the timer is gone.
    vi.advanceTimersByTime(5_000)
    expect(sampler.samples()).toHaveLength(3)
  })
})
