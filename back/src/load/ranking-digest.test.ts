import { describe, expect, it } from 'vitest'

import { canonicalJson, rankingDigest } from './ranking-digest'

const team = (score: number) => ({
  teamId: 't1',
  teamName: 'Time 1',
  rank: 1,
  totalScore: score,
  totalAttempts: 1,
  tiebreakTimeMs: 10,
  problems: [{ problemId: 'p1', score, attempts: 1, maxScore: 100 }],
})

const snapshot = (score: number) => ({
  round: {
    roundId: 'r1',
    roundName: 'load-x',
    problemIds: ['p1'],
    denominators: 'consistent' as const,
    teams: [team(score)],
  },
  event: { rounds: [], teams: [] },
})

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    )
  })
})

describe('rankingDigest', () => {
  it('does not change when the keys come in another order', () => {
    const reordered = {
      event: { teams: [], rounds: [] },
      round: Object.fromEntries(Object.entries(snapshot(100).round).reverse()),
    }
    expect(rankingDigest(reordered)).toBe(rankingDigest(snapshot(100)))
  })

  it('ignores serverTime and any field the ranking schemas do not carry', () => {
    const withExtras = { ...snapshot(100), serverTime: '2026-10-05T00:00:00.000Z', type: 'x' }
    expect(rankingDigest(withExtras)).toBe(rankingDigest(snapshot(100)))
  })

  it('changes when a score changes', () => {
    expect(rankingDigest(snapshot(60))).not.toBe(rankingDigest(snapshot(100)))
  })

  it('tells a missing round ranking apart from an empty one', () => {
    const none = { round: null, event: { rounds: [], teams: [] } }
    expect(rankingDigest(none)).not.toBe(
      rankingDigest({ ...snapshot(0), round: { ...snapshot(0).round, teams: [] } }),
    )
  })
})
