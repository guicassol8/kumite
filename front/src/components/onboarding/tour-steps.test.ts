import { describe, expect, it } from 'vitest'

import en from '@/i18n/en.json'
import es from '@/i18n/es.json'
import pt from '@/i18n/pt.json'

import { TOUR_STEPS, tourStepKeys } from './tour-steps'

function lookup(catalog: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      catalog,
    )
}

describe('TOUR_STEPS', () => {
  it('walks the six points of the issue, in order', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'header',
      'round',
      'teams',
      'editor',
      'leaderboard',
      'practice',
    ])
  })

  it('gives every step at least one target', () => {
    for (const step of TOUR_STEPS) expect(step.targets.length).toBeGreaterThan(0)
  })

  it.each([
    ['pt', pt],
    ['es', es],
    ['en', en],
  ])('has a non-empty title and body for every step in %s', (_locale, catalog) => {
    for (const step of TOUR_STEPS) {
      const keys = tourStepKeys(step.id)
      expect(lookup(catalog, keys.title)).toEqual(expect.stringMatching(/\S/))
      expect(lookup(catalog, keys.body)).toEqual(expect.stringMatching(/\S/))
    }
  })
})
