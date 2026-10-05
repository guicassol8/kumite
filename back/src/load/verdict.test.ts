import { describe, expect, it } from 'vitest'

import { classifyVerdict, isCoherent, rejectedVerdict } from './verdict'

const visible = (outcome: 'passed' | 'failed' | 'timeout' | 'runtime_error') => ({
  hidden: false as const,
  index: 0,
  outcome,
  expected: 1,
  ms: 1,
})
const hidden = (outcome: 'passed' | 'failed' | 'timeout' | 'runtime_error') => ({
  hidden: true as const,
  index: 1,
  outcome,
})

describe('classifyVerdict', () => {
  it('is accepted only when every case passed, hidden ones included', () => {
    expect(classifyVerdict({ cases: [visible('passed'), hidden('passed')] })).toBe('accepted')
    expect(classifyVerdict({ cases: [visible('passed'), hidden('failed')] })).toBe('wrong_answer')
  })

  it('lets a timeout win over a failed case and over a runtime error', () => {
    expect(classifyVerdict({ cases: [visible('failed'), hidden('timeout')] })).toBe('timeout')
    expect(classifyVerdict({ cases: [visible('runtime_error'), visible('timeout')] })).toBe(
      'timeout',
    )
  })

  it('lets a runtime error win over a failed case', () => {
    expect(classifyVerdict({ cases: [visible('failed'), hidden('runtime_error')] })).toBe(
      'runtime_error',
    )
  })

  it('never calls an empty case list accepted', () => {
    expect(classifyVerdict({ cases: [] })).toBe('wrong_answer')
  })
})

describe('isCoherent', () => {
  it('expects accepted for the correct solution and timeout for the infinite loop', () => {
    expect(isCoherent('correct', 'accepted')).toBe(true)
    expect(isCoherent('loop', 'timeout')).toBe(true)
  })

  it('flags every other pairing', () => {
    expect(isCoherent('correct', 'timeout')).toBe(false)
    expect(isCoherent('correct', 'wrong_answer')).toBe(false)
    expect(isCoherent('loop', 'accepted')).toBe(false)
    expect(isCoherent('loop', 'runtime_error')).toBe(false)
    expect(isCoherent('correct', rejectedVerdict('codegen_rejected'))).toBe(false)
  })
})
