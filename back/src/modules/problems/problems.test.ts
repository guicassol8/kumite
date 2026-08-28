import { describe, expect, it } from 'vitest'

import { TestCaseSchema } from './problems.schema'

describe('TestCaseSchema', () => {
  it('accepts a valid test case', () => {
    const result = TestCaseSchema.safeParse({ input: [1, 2], expected: 3, hidden: false })
    expect(result.success).toBe(true)
  })

  it('rejects a non-boolean hidden flag', () => {
    const result = TestCaseSchema.safeParse({ input: 1, expected: 2, hidden: 'yes' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing input', () => {
    const result = TestCaseSchema.safeParse({ expected: 2, hidden: false })
    expect(result.success).toBe(false)
  })
})
