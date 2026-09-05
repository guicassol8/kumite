import { describe, expect, it } from 'vitest'

import {
  rankTeams,
  reduceBestPerProblem,
  type ScoringEntry,
  type ScoringRow,
  sumScoring,
  toScoringEntries,
} from './ranking.service'

// --- Pure core (no db) ---

describe('reduceBestPerProblem', () => {
  it('zeroes a team/key pair with no rows', () => {
    const result = reduceBestPerProblem([], ['team-a'], ['p1'])

    expect(result.get('team-a')?.get('p1')).toEqual({ score: 0, attempts: 0, achievedAt: null })
  })

  it('picks the highest score and counts every attempt', () => {
    const rows: ScoringRow[] = [
      { teamId: 'team-a', key: 'p1', score: 20, createdAt: new Date('2026-09-01T10:00:00Z') },
      { teamId: 'team-a', key: 'p1', score: 80, createdAt: new Date('2026-09-01T10:05:00Z') },
      { teamId: 'team-a', key: 'p1', score: 50, createdAt: new Date('2026-09-01T10:10:00Z') },
    ]

    expect(reduceBestPerProblem(rows, ['team-a'], ['p1']).get('team-a')?.get('p1')).toEqual({
      score: 80,
      attempts: 3,
      achievedAt: new Date('2026-09-01T10:05:00Z'),
    })
  })

  it('resolves a tied best score to the earliest submission', () => {
    const earliest = new Date('2026-09-01T10:00:00Z')
    const rows: ScoringRow[] = [
      { teamId: 'team-a', key: 'p1', score: 80, createdAt: earliest },
      { teamId: 'team-a', key: 'p1', score: 80, createdAt: new Date('2026-09-01T10:05:00Z') },
    ]

    expect(reduceBestPerProblem(rows, ['team-a'], ['p1']).get('team-a')?.get('p1')).toEqual({
      score: 80,
      attempts: 2,
      achievedAt: earliest,
    })
  })

  it('keeps teams and keys independent', () => {
    const rows: ScoringRow[] = [
      { teamId: 'team-a', key: 'p1', score: 90, createdAt: new Date('2026-09-01T10:00:00Z') },
      { teamId: 'team-b', key: 'p2', score: 40, createdAt: new Date('2026-09-01T10:00:00Z') },
    ]

    const result = reduceBestPerProblem(rows, ['team-a', 'team-b'], ['p1', 'p2'])

    expect(result.get('team-a')?.get('p1')?.score).toBe(90)
    expect(result.get('team-a')?.get('p2')?.score).toBe(0)
    expect(result.get('team-b')?.get('p1')?.score).toBe(0)
    expect(result.get('team-b')?.get('p2')?.score).toBe(40)
  })
})

describe('toScoringEntries', () => {
  const referenceTime = new Date('2026-09-01T10:00:00Z')

  it('measures elapsed time from the reference only when scored above zero', () => {
    const best = new Map([
      ['p1', { score: 80, attempts: 2, achievedAt: new Date('2026-09-01T10:05:00Z') }],
      ['p2', { score: 0, attempts: 1, achievedAt: new Date('2026-09-01T10:01:00Z') }],
    ])

    expect(toScoringEntries(best, ['p1', 'p2'], referenceTime)).toEqual([
      { key: 'p1', score: 80, attempts: 2, elapsedMs: 5 * 60_000 },
      { key: 'p2', score: 0, attempts: 1, elapsedMs: null },
    ])
  })

  it('defaults a missing key to a zeroed entry', () => {
    expect(toScoringEntries(new Map(), ['p1'], referenceTime)).toEqual([
      { key: 'p1', score: 0, attempts: 0, elapsedMs: null },
    ])
  })
})

describe('sumScoring', () => {
  it('sums score and attempts, and elapsed time only over scored entries', () => {
    const entries: ScoringEntry[] = [
      { key: 'p1', score: 80, attempts: 2, elapsedMs: 1000 },
      { key: 'p2', score: 0, attempts: 3, elapsedMs: null },
      { key: 'p3', score: 20, attempts: 1, elapsedMs: 500 },
    ]

    expect(sumScoring(entries)).toEqual({ totalScore: 100, totalAttempts: 6, tiebreakTimeMs: 1500 })
  })

  it('sums to zero over no entries', () => {
    expect(sumScoring([])).toEqual({ totalScore: 0, totalAttempts: 0, tiebreakTimeMs: 0 })
  })
})

describe('rankTeams', () => {
  function entry(overrides: Partial<ScoringEntry> = {}): ScoringEntry {
    return { key: 'p1', score: 0, attempts: 0, elapsedMs: null, ...overrides }
  }

  it('orders by total score, highest first', () => {
    const ranked = rankTeams([
      { teamId: 'a', teamName: 'Alfa', entries: [entry({ score: 50 })] },
      { teamId: 'b', teamName: 'Beta', entries: [entry({ score: 90 })] },
    ])

    expect(ranked.map((team) => team.teamId)).toEqual(['b', 'a'])
    expect(ranked.map((team) => team.rank)).toEqual([1, 2])
  })

  it('breaks a score tie by the lowest tiebreak time', () => {
    const ranked = rankTeams([
      { teamId: 'a', teamName: 'Alfa', entries: [entry({ score: 80, elapsedMs: 5000 })] },
      { teamId: 'b', teamName: 'Beta', entries: [entry({ score: 80, elapsedMs: 2000 })] },
    ])

    expect(ranked.map((team) => team.teamId)).toEqual(['b', 'a'])
  })

  it('breaks a score and time tie by fewer attempts', () => {
    const ranked = rankTeams([
      {
        teamId: 'a',
        teamName: 'Alfa',
        entries: [entry({ score: 80, elapsedMs: 2000, attempts: 5 })],
      },
      {
        teamId: 'b',
        teamName: 'Beta',
        entries: [entry({ score: 80, elapsedMs: 2000, attempts: 2 })],
      },
    ])

    expect(ranked.map((team) => team.teamId)).toEqual(['b', 'a'])
  })

  it('breaks a full tie alphabetically by team name', () => {
    const ranked = rankTeams([
      {
        teamId: 'a',
        teamName: 'Zulu',
        entries: [entry({ score: 80, elapsedMs: 2000, attempts: 2 })],
      },
      {
        teamId: 'b',
        teamName: 'Alfa',
        entries: [entry({ score: 80, elapsedMs: 2000, attempts: 2 })],
      },
    ])

    expect(ranked.map((team) => team.teamName)).toEqual(['Alfa', 'Zulu'])
  })

  it('lists a team with no submissions at all at the end, still ordered by name', () => {
    const ranked = rankTeams([
      { teamId: 'a', teamName: 'Zulu', entries: [entry({ score: 0 })] },
      { teamId: 'b', teamName: 'Alfa', entries: [entry({ score: 0 })] },
      { teamId: 'c', teamName: 'Beta', entries: [entry({ score: 90 })] },
    ])

    expect(ranked.map((team) => team.teamName)).toEqual(['Beta', 'Alfa', 'Zulu'])
    expect(ranked.map((team) => team.rank)).toEqual([1, 2, 3])
  })
})
