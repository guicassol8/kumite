import { describe, expect, it } from 'vitest'

import { RESULTS_DEFAULT_SIZE, resultsOpenSize } from './results-band'

// The size the results band opens at when a run lands (#366, #307). The
// geometry lives in e2e (problem-layout, problem-panels): this pins the rule.
describe('resultsOpenSize', () => {
  it('opens at the default when nothing was ever saved', () => {
    expect(resultsOpenSize(undefined)).toBe(RESULTS_DEFAULT_SIZE)
  })

  it('restores the size the participant dragged the band to, as a percentage string', () => {
    // A string on purpose: `Panel.resize(40)` would read 40 as *pixels*.
    expect(resultsOpenSize({ canvas: 60, results: 40 })).toBe('40%')
  })

  it.each([
    ['collapsed by a drag (0 — no preference, #366 premise 2)', { canvas: 100, results: 0 }],
    ['not a number', { canvas: 60, results: Number.NaN }],
    ['the whole group', { canvas: 0, results: 100 }],
    ['past the whole group', { canvas: 0, results: 120 }],
    ['negative', { canvas: 100, results: -5 }],
    ['missing the results panel', { canvas: 100 }],
  ])('falls back to the default when the saved size is %s', (_, saved) => {
    expect(resultsOpenSize(saved)).toBe(RESULTS_DEFAULT_SIZE)
  })
})
