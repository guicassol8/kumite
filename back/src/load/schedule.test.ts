import { describe, expect, it } from 'vitest'

import { isBadAt, kindAt, mapLimit, sleep, submissionIndex } from './schedule'

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

describe('kindAt', () => {
  const kinds = (n: number, bad: number, memoryShare: number) =>
    Array.from({ length: n }, (_, i) => kindAt(i, bad, memoryShare))

  it('makes 30 of 100 bad at 0.3, half of them memory bombs, always the same ones', () => {
    const first = kinds(100, 0.3, 0.5)

    expect(first.filter((kind) => kind !== 'correct')).toHaveLength(30)
    expect(first.filter((kind) => kind === 'memory')).toHaveLength(15)
    expect(first.filter((kind) => kind === 'loop')).toHaveLength(15)
    expect(kinds(100, 0.3, 0.5)).toEqual(first)
  })

  it('sends the #136 sequence when no bad submission is a memory bomb', () => {
    const expected = Array.from({ length: 30 }, (_, i) => (isBadAt(i, 0.1) ? 'loop' : 'correct'))
    expect(kinds(30, 0.1, 0)).toEqual(expected)
  })

  it('turns every bad one into a memory bomb at a share of 1', () => {
    expect(kinds(10, 0.2, 1).filter((kind) => kind === 'memory')).toHaveLength(2)
    expect(kinds(10, 0.2, 1)).not.toContain('loop')
  })
})

describe('submissionIndex (#453)', () => {
  /** Each team's indices below `n`, in turn order. */
  function shares(n: number, teams: number): number[][] {
    return Array.from({ length: teams }, (_, team) => {
      const indices: number[] = []
      for (let turn = 0; ; turn++) {
        const index = submissionIndex(turn, team, teams)
        if (index >= n) return indices
        indices.push(index)
      }
    })
  }

  it.each([0, 1, 6, 7, 30, 300].flatMap((n) => [1, 2, 3, 10, 100].map((teams) => ({ n, teams }))))(
    'splits $n submissions over $teams teams, each index exactly once',
    ({ n, teams }) => {
      const byTeam = shares(n, teams)
      expect(byTeam.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i))
      const sizes = byTeam.map((indices) => indices.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
      // The first n mod T teams get the larger share: ceil((n − t) / T), none
      // past the n-th team (max: the ceil of a negative fraction is −0).
      expect(sizes).toEqual(byTeam.map((_, team) => Math.max(0, Math.ceil((n - team) / teams))))
    },
  )

  it('keeps the first wave as before: turn 0 is 0..T−1 in team order', () => {
    expect(Array.from({ length: 10 }, (_, team) => submissionIndex(0, team, 10))).toEqual(
      Array.from({ length: 10 }, (_, i) => i),
    )
  })

  it('gives 2 teams of 6 submissions three each', () => {
    expect(shares(6, 2)).toEqual([
      [0, 2, 4],
      [1, 3, 5],
    ])
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
