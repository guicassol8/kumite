import { describe, expect, it } from 'vitest'

import { MAX_TEAM_SIZE_MAX, POINTS_MAX } from './field-limits'

// These assertions look tautological on purpose. The constants mirror ceilings
// that live in the back's request schemas, and nothing in the type system ties
// the two together: `.max()` does not change the inferred type, so the RPC
// client cannot carry it. The back pins the same literals in
// back/src/request-limits.test.ts, so raising one side without the other turns
// one of the two suites red instead of silently shipping a form that promises
// the wrong limit.
describe('field limits mirrored from the back', () => {
  it('pins POINTS_MAX to PROBLEM_POINTS_MAX', () => {
    expect(POINTS_MAX).toBe(10_000)
  })

  it('pins MAX_TEAM_SIZE_MAX to EVENT_MAX_TEAM_SIZE', () => {
    expect(MAX_TEAM_SIZE_MAX).toBe(10)
  })
})
