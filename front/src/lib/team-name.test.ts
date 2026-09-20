import { describe, expect, it } from 'vitest'

import { displayTeamName, normalizeTeamName } from './team-name'

describe('normalizeTeamName', () => {
  // The same table as back/src/modules/teams/teams.test.ts — this pair is what
  // pins the two copies of the rule together (#185).
  it.each([
    ['  Os Dragoes  ', 'Os Dragoes'],
    ['Os   Dragoes', 'Os Dragoes'],
    ['Os\tDragoes', 'Os Dragoes'],
    ['Os\nDragoes', 'Os Dragoes'],
    ['Os Dragoes', 'Os Dragoes'],
    ['\t Os \n Dragoes  ', 'Os Dragoes'],
    ['   ', ''],
    ['', ''],
    ['Os Dragoes', 'Os Dragoes'],
  ])('normalizes %j into %j', (raw, expected) => {
    expect(normalizeTeamName(raw)).toBe(expected)
  })

  it('is idempotent', () => {
    for (const raw of ['  Os   Dragoes  ', '   ', 'Os Dragoes', 'A  B']) {
      expect(normalizeTeamName(normalizeTeamName(raw))).toBe(normalizeTeamName(raw))
    }
  })
})

describe('displayTeamName', () => {
  it('keeps a name that has visible characters', () => {
    expect(displayTeamName('Os Dragoes', 'Time sem nome')).toBe('Os Dragoes')
  })

  it.each(['', '   ', '\t\n', ' '])('falls back for the legacy blank name %j', (blank) => {
    expect(displayTeamName(blank, 'Time sem nome')).toBe('Time sem nome')
  })

  it('takes the fallback from the caller, so each screen can label it its own way', () => {
    expect(displayTeamName('   ', 'Time sem nome - 1a2b3c4d')).toBe('Time sem nome - 1a2b3c4d')
  })
})
