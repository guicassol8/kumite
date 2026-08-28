import { describe, expect, it } from 'vitest'

import { JsonValueSchema } from './json'

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
