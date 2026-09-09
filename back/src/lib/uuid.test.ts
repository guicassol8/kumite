import { describe, expect, it } from 'vitest'

import { UuidSchema } from './uuid'

describe('UuidSchema', () => {
  it('accepts a v4 uuid', () => {
    expect(UuidSchema.safeParse(crypto.randomUUID()).success).toBe(true)
  })

  it('accepts the nil uuid', () => {
    // auth-guards.test.ts and users.hurl both probe "well-formed but unknown"
    // with this exact value and expect the handler's 404 — not a 422.
    expect(UuidSchema.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true)
  })

  it.each(['nao-e-uuid', '', ' 3f2504e0-4f89-41d3-9a0c-0305e82c3301 ', '3f2504e0-4f89-41d3-9a0c'])(
    'rejects %j',
    (value) => {
      expect(UuidSchema.safeParse(value).success).toBe(false)
    },
  )
})
