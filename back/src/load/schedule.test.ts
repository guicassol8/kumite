import { describe, expect, it } from 'vitest'

import { isBadAt, mapLimit, sleep } from './schedule'

describe('isBadAt', () => {
  it('marks exactly 3 of 30 submissions bad at f = 0.1, always the same ones', () => {
    const first = Array.from({ length: 30 }, (_, i) => isBadAt(i, 0.1))
    const second = Array.from({ length: 30 }, (_, i) => isBadAt(i, 0.1))

    expect(first.filter(Boolean)).toHaveLength(3)
    expect(second).toEqual(first)
    expect(first.flatMap((bad, i) => (bad ? [i] : []))).toEqual([9, 19, 29])
  })

  it('never marks anything at f = 0 and marks everything at f = 1', () => {
    expect(Array.from({ length: 20 }, (_, i) => isBadAt(i, 0)).some(Boolean)).toBe(false)
    expect(Array.from({ length: 20 }, (_, i) => isBadAt(i, 1)).every(Boolean)).toBe(true)
  })

  it('spreads the bad ones evenly at f = 0.25', () => {
    const bad = Array.from({ length: 8 }, (_, i) => isBadAt(i, 0.25))
    expect(bad.flatMap((b, i) => (b ? [i] : []))).toEqual([3, 7])
  })
})

describe('mapLimit', () => {
  it('never runs more than the limit at once and keeps the input order', async () => {
    let running = 0
    let peak = 0
    const results = await mapLimit([5, 1, 4, 2, 3, 0, 6], 3, async (value) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, value))
      running -= 1
      return value * 10
    })

    expect(peak).toBeLessThanOrEqual(3)
    expect(results).toEqual([50, 10, 40, 20, 30, 0, 60])
  })

  it('settles every item even when some reject, then rethrows the first error', async () => {
    const seen: number[] = []
    await expect(
      mapLimit([1, 2, 3], 2, async (value) => {
        seen.push(value)
        if (value === 2) throw new Error('boom')
        return value
      }),
    ).rejects.toThrow('boom')
    expect(seen.sort()).toEqual([1, 2, 3])
  })

  it('handles an empty list', async () => {
    expect(await mapLimit([], 4, async (value: number) => value)).toEqual([])
  })
})

describe('sleep', () => {
  it('resolves early, without throwing, when the signal aborts', async () => {
    const controller = new AbortController()
    const pending = sleep(60_000, controller.signal)
    controller.abort()
    await expect(pending).resolves.toBeUndefined()
  })

  it('resolves at once on an already-aborted signal', async () => {
    await expect(sleep(60_000, AbortSignal.abort())).resolves.toBeUndefined()
  })
})
