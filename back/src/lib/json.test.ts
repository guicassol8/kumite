import { describe, expect, it } from 'vitest'

import { canonicalJson, JsonValueSchema } from './json'

describe('JsonValueSchema', () => {
  it.each([
    ['string', 'hello'],
    ['number', 42],
    ['boolean', true],
    ['null', null],
    ['nested object', { a: 1, b: { c: [1, 2, 'three'] } }],
    ['array', [1, 'two', { three: 3 }, null]],
  ])('accepts a %s', (_label, value) => {
    expect(JsonValueSchema.safeParse(value).success).toBe(true)
  })

  it.each([
    ['undefined', undefined],
    ['a function', () => {}],
    ['a Symbol', Symbol('x')],
  ])('rejects %s', (_label, value) => {
    expect(JsonValueSchema.safeParse(value).success).toBe(false)
  })
})

describe('canonicalJson', () => {
  it('ignores object key order — the same jsonb value serializes identically', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }))
  })

  it('sorts keys recursively, not just at the top level', () => {
    expect(canonicalJson({ outer: { z: 1, a: 2 } })).toBe(canonicalJson({ outer: { a: 2, z: 1 } }))
  })

  it('keeps array order significant — a reordered array is a different value', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })

  it('does not sort keys inside arrays away from their element', () => {
    expect(canonicalJson([{ b: 1 }, { a: 2 }])).not.toBe(canonicalJson([{ a: 2 }, { b: 1 }]))
  })

  it.each([
    ['null', null],
    ['an empty array', []],
    ['an empty object', {}],
    ['a string', 'hello'],
    ['a number', 42],
    ['a boolean', false],
  ])('round-trips %s', (_label, value) => {
    expect(JSON.parse(canonicalJson(value as never))).toEqual(value)
  })

  it('distinguishes values that differ only deep inside', () => {
    expect(canonicalJson({ a: { b: [1, { c: null }] } })).not.toBe(
      canonicalJson({ a: { b: [1, { c: 0 }] } }),
    )
  })

  it('distinguishes a missing key from an explicit null', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 1, b: null }))
  })
})
