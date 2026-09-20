import { describe, expect, it } from 'vitest'

import { displayTeamName, normalizeTeamName } from './team-name'

// Built from its code point on purpose: a literal NBSP in the source is
// indistinguishable from a plain space, and this table exists precisely to
// tell the two apart (#185). The formatter rewrites a ' ' escape into the
// invisible character itself, so the constant is what keeps it readable.
const NBSP = String.fromCharCode(0xa0)

describe('normalizeTeamName', () => {
  // The same table as back/src/modules/teams/teams.test.ts — this pair is what
  // pins the two copies of the rule together (#185).
  it.each([
    ['  Os Dragoes  ', 'Os Dragoes'],
    ['Os   Dragoes', 'Os Dragoes'],
    ['Os\tDragoes', 'Os Dragoes'],
    ['Os\nDragoes', 'Os Dragoes'],
    [`Os${NBSP}Dragoes`, 'Os Dragoes'],
    [`\t Os \n Dragoes ${NBSP}`, 'Os Dragoes'],
    ['   ', ''],
    ['', ''],
    ['Os Dragoes', 'Os Dragoes'],
  ])('normalizes %j into %j', (raw, expected) => {
    expect(normalizeTeamName(raw)).toBe(expected)
  })

  it('is idempotent', () => {
    for (const raw of ['  Os   Dragoes  ', '   ', 'Os Dragoes', `A${NBSP}${NBSP}B`]) {
      expect(normalizeTeamName(normalizeTeamName(raw))).toBe(normalizeTeamName(raw))
    }
  })
})

describe('displayTeamName', () => {
  it('keeps a name that has visible characters', () => {
    expect(displayTeamName('Os Dragoes', 'Time sem nome')).toBe('Os Dragoes')
  })

  it.each(['', '   ', '\t\n', NBSP])('falls back for the legacy blank name %j', (blank) => {
    expect(displayTeamName(blank, 'Time sem nome')).toBe('Time sem nome')
  })

  it('takes the fallback from the caller, so each screen can label it its own way', () => {
    expect(displayTeamName('   ', 'Time sem nome - 1a2b3c4d')).toBe('Time sem nome - 1a2b3c4d')
  })
})
