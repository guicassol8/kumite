import { describe, expect, it } from 'vitest'

import { evaluateConsistency, isJudgeDrained } from './settle'

describe('evaluateConsistency', () => {
  it('is consistent when every connection holds the API’s digest', () => {
    expect(evaluateConsistency(['a', 'a', 'a'], 'a')).toEqual({
      compared: 3,
      withoutRanking: 0,
      distinctDigests: 1,
      matchesApi: true,
      consistent: true,
    })
  })

  it('flags connections that disagree with each other', () => {
    expect(evaluateConsistency(['a', 'b', 'a'], 'a')).toMatchObject({
      distinctDigests: 2,
      matchesApi: false,
      consistent: false,
    })
  })

  it('flags connections that agree with each other but not with the API', () => {
    expect(evaluateConsistency(['b', 'b'], 'a')).toMatchObject({
      distinctDigests: 1,
      matchesApi: false,
      consistent: false,
    })
  })

  it('flags a connection that never received a ranking, and an unreadable API', () => {
    expect(evaluateConsistency(['a', null], 'a')).toMatchObject({
      withoutRanking: 1,
      consistent: false,
    })
    expect(evaluateConsistency(['a'], null)).toMatchObject({ matchesApi: false })
  })

  it('has nothing to compare without connections, which is not a failure', () => {
    expect(evaluateConsistency([], 'a')).toEqual({
      compared: 0,
      withoutRanking: 0,
      distinctDigests: 0,
      matchesApi: null,
      consistent: true,
    })
  })
})

describe('isJudgeDrained (#277)', () => {
  it('accepts every live worker idle in the pool, with nothing in flight or queued', () => {
    expect(isJudgeDrained({ inFlight: 0, waiting: 0, alive: 2, idle: 2 })).toBe(true)
    expect(isJudgeDrained({ inFlight: 0, waiting: 0, alive: 0, idle: 0 })).toBe(true)
  })

  it('refuses a live worker that is not idle: busy, or discarded and not yet exited', () => {
    expect(isJudgeDrained({ inFlight: 0, waiting: 0, alive: 3, idle: 2 })).toBe(false)
  })

  it('refuses a submission in flight or queued', () => {
    expect(isJudgeDrained({ inFlight: 1, waiting: 0, alive: 2, idle: 2 })).toBe(false)
    expect(isJudgeDrained({ inFlight: 0, waiting: 1, alive: 2, idle: 2 })).toBe(false)
  })
})
