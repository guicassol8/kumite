import { describe, expect, it } from 'vitest'

import { endedSince, pushBounded } from './ring'

describe('pushBounded', () => {
  it('keeps every entry while under the limit, oldest first', () => {
    const ring: number[] = []
    pushBounded(ring, 1, 3)
    pushBounded(ring, 2, 3)
    expect(ring).toEqual([1, 2])
  })

  it('drops the oldest entries past the limit', () => {
    const ring: number[] = []
    for (const n of [1, 2, 3, 4, 5]) pushBounded(ring, n, 3)
    expect(ring).toEqual([3, 4, 5])
  })
})

describe('endedSince', () => {
  const ring = [{ endedAt: 10 }, { endedAt: 20 }, { endedAt: 30 }]

  it('returns a copy of every entry without a cut', () => {
    const all = endedSince(ring)
    expect(all).toEqual(ring)
    expect(all).not.toBe(ring)
  })

  it('keeps the entries that ended at or after the cut', () => {
    expect(endedSince(ring, 20)).toEqual([{ endedAt: 20 }, { endedAt: 30 }])
    expect(endedSince(ring, 31)).toEqual([])
  })
})
