import { describe, expect, it } from 'vitest'

import { percentile, summarize } from './stats'

describe('percentile', () => {
  it('is null on an empty list', () => {
    expect(percentile([], 50)).toBeNull()
  })

  it('returns the only element of a one-element list for every p', () => {
    expect(percentile([7], 0)).toBe(7)
    expect(percentile([7], 50)).toBe(7)
    expect(percentile([7], 99)).toBe(7)
    expect(percentile([7], 100)).toBe(7)
  })

  it('uses nearest rank on a sorted list', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(values, 50)).toBe(5)
    expect(percentile(values, 95)).toBe(10)
    expect(percentile(values, 10)).toBe(1)
    expect(percentile(values, 11)).toBe(2)
    expect(percentile(values, 100)).toBe(10)
  })
})

describe('summarize', () => {
  it('reports count 0 and nulls for an empty list', () => {
    expect(summarize([])).toEqual({
      count: 0,
      min: null,
      p50: null,
      p95: null,
      p99: null,
      max: null,
      mean: null,
    })
  })

  it('sorts a copy and never mutates the input', () => {
    const values = [30, 10, 20]
    const summary = summarize(values)
    expect(values).toEqual([30, 10, 20])
    expect(summary).toEqual({ count: 3, min: 10, p50: 20, p95: 30, p99: 30, max: 30, mean: 20 })
  })

  it('takes the tail percentiles from the top of a long list', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    const summary = summarize(values)
    expect(summary.p50).toBe(50)
    expect(summary.p95).toBe(95)
    expect(summary.p99).toBe(99)
    expect(summary.max).toBe(100)
    expect(summary.mean).toBe(50.5)
  })
})
