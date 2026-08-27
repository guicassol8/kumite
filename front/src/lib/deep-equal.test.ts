import { describe, expect, it } from 'vitest'

import { deepEqual } from './deep-equal'

describe('deepEqual', () => {
  it('compares primitives by value, never coercing across types', () => {
    expect(deepEqual(6, 6)).toBe(true)
    expect(deepEqual(6, '6')).toBe(false)
    expect(deepEqual(0, false)).toBe(false)
    expect(deepEqual('', false)).toBe(false)
    expect(deepEqual(true, true)).toBe(true)
  })

  it('separates null from undefined', () => {
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual(null, 0)).toBe(false)
  })

  it('treats NaN as equal to itself and -0 as equal to 0', () => {
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true)
    expect(deepEqual(Number.NaN, 0)).toBe(false)
    expect(deepEqual(-0, 0)).toBe(true)
  })

  it('compares arrays by length and by index', () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(deepEqual([], [])).toBe(true)
  })

  it('never equates an array with a plain object', () => {
    expect(deepEqual([1], { 0: 1 })).toBe(false)
    expect(deepEqual({ 0: 1, length: 1 }, [1])).toBe(false)
  })

  it('compares plain objects by key set and value, ignoring key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({}, {})).toBe(true)
  })

  it('recurses through nested structures', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
    expect(deepEqual([[1], [2]], [[1], [2]])).toBe(true)
    expect(deepEqual([[1], [2]], [[1], [3]])).toBe(false)
  })
})
