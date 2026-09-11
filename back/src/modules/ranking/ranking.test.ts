import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import {
  problemsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import { closeRound, createRound, getProblemRoundAccess, openRound } from '../rounds/rounds.service'
import { getBestSubmission } from '../submissions/submissions.service'

import {
  getEventRanking,
  getRoundRanking,
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

// --- DB-backed assembly (real Postgres, as in submissions.test.ts) ---

const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemsTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

async function insertProblem(points = 100) {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published', points })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  return problem
}

async function insertTeam(name: string) {
  const [team] = await db.insert(teamsTable).values({ name }).returning()
  if (!team) throw new Error('expected a team fixture')
  return team
}

let userCounter = 0

// userId is required by the submissions schema but irrelevant to ranking,
// which groups by team — a fresh user per call keeps fixtures independent.
async function insertUser() {
  userCounter += 1
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `ranking-fixture-${userCounter}@edu.pucrs.br`,
      passwordHash: 'hash',
      role: 'participant',
      university: 'pucrs',
    })
    .returning()
  if (!user) throw new Error('expected a user fixture')
  return user
}

// roundId is explicit, not derived from the clock (#176): the round a
// submission belongs to is stamped on the row, so a fixture has to say which
// round it is submitting into.
async function submit(
  roundId: string,
  teamId: string,
  problemId: string,
  score: number,
  options: { attemptNumber?: number } = {},
) {
  const user = await insertUser()
  await db.insert(submissionsTable).values({
    problemId,
    roundId,
    teamId,
    userId: user.id,
    workspace: {},
    generatedCode: '',
    caseResults: [],
    score,
    attemptNumber: options.attemptNumber ?? 1,
  })
}

describe('getRoundRanking', () => {
  it('returns null for an unknown round', async () => {
    expect(await getRoundRanking(db, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('returns null for a round still in draft', async () => {
    const problem = await insertProblem()
    const created = await createRound(db, {
      name: 'Rodada 1',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!created.ok) throw new Error('expected create to succeed')

    expect(await getRoundRanking(db, created.round.id)).toBeNull()
  })

  it('orders teams by score, zeroes a team that never submitted', async () => {
    const problem = await insertProblem()
    const teamA = await insertTeam('Time A')
    const teamB = await insertTeam('Time B')
    const teamC = await insertTeam('Time C')
    const created = await createRound(db, {
      name: 'Rodada 1',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!created.ok) throw new Error('expected create to succeed')
    const opened = await openRound(db, created.round.id)
    if (!opened.ok) throw new Error('expected open to succeed')

    await submit(opened.round.id, teamA.id, problem.id, 100)
    await submit(opened.round.id, teamB.id, problem.id, 50)

    const ranking = await getRoundRanking(db, opened.round.id)

    expect(ranking?.problemIds).toEqual([problem.id])
    expect(ranking?.teams.map((team) => [team.teamName, team.totalScore, team.rank])).toEqual([
      ['Time A', 100, 1],
      ['Time B', 50, 2],
      ['Time C', 0, 3],
    ])
    expect(ranking?.teams[0]?.problems).toEqual([
      { problemId: problem.id, score: 100, attempts: 1 },
    ])
  })

  it('counts each submission in the round it was stamped with, even for a reused problem', async () => {
    const problem = await insertProblem()
    const team = await insertTeam('Time A')

    const firstRound = await createRound(db, {
      name: 'Rodada 1',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!firstRound.ok) throw new Error('expected create to succeed')
    const openedFirst = await openRound(db, firstRound.round.id)
    if (!openedFirst.ok) throw new Error('expected open to succeed')
    await submit(openedFirst.round.id, team.id, problem.id, 100)
    const closedFirst = await closeRound(db, firstRound.round.id)
    if (!closedFirst.ok) throw new Error('expected close to succeed')

    const secondRound = await createRound(db, {
      name: 'Rodada 2',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!secondRound.ok) throw new Error('expected create to succeed')
    const openedSecond = await openRound(db, secondRound.round.id)
    if (!openedSecond.ok) throw new Error('expected open to succeed')
    // Same team + problem as the first round's submission above: the unique
    // index is on (team, problem, attempt), so this is attempt 2 overall —
    // exactly the point being proven, that each round counts only the
    // submissions stamped with its own id.
    await submit(openedSecond.round.id, team.id, problem.id, 40, { attemptNumber: 2 })

    const firstRanking = await getRoundRanking(db, firstRound.round.id)
    const secondRanking = await getRoundRanking(db, secondRound.round.id)

    expect(firstRanking?.teams[0]).toMatchObject({ totalScore: 100 })
    expect(secondRanking?.teams[0]).toMatchObject({ totalScore: 40 })
  })

  // #176 AC3: the problem page and the round's leaderboard have to show the
  // same number. They used to diverge on a reused problem — the page reduced
  // over every round at once, the leaderboard over one round.
  it('agrees with the problem page on the score of a reused problem', async () => {
    const problem = await insertProblem()
    const team = await insertTeam('Time A')

    const firstRound = await createRound(db, {
      name: 'Rodada 1',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!firstRound.ok) throw new Error('expected create to succeed')
    const openedFirst = await openRound(db, firstRound.round.id)
    if (!openedFirst.ok) throw new Error('expected open to succeed')
    await submit(openedFirst.round.id, team.id, problem.id, 100)
    const closedFirst = await closeRound(db, firstRound.round.id)
    if (!closedFirst.ok) throw new Error('expected close to succeed')

    const secondRound = await createRound(db, {
      name: 'Rodada 2',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!secondRound.ok) throw new Error('expected create to succeed')
    const openedSecond = await openRound(db, secondRound.round.id)
    if (!openedSecond.ok) throw new Error('expected open to succeed')
    await submit(openedSecond.round.id, team.id, problem.id, 40, { attemptNumber: 2 })
    const closedSecond = await closeRound(db, secondRound.round.id)
    if (!closedSecond.ok) throw new Error('expected close to succeed')

    // The page reads the round the participant has just played (the most
    // recently opened one containing the problem).
    const access = await getProblemRoundAccess(db, problem.id)
    if (access.status !== 'closed') throw new Error('expected closed round access')
    expect(access.roundId).toBe(secondRound.round.id)

    const pageScore = await getBestSubmission(db, team.id, problem.id, access.roundId)
    const secondRanking = await getRoundRanking(db, secondRound.round.id)

    // 40, the second round's score — not 100, the best across both rounds.
    expect(pageScore?.score).toBe(40)
    expect(secondRanking?.teams[0]?.problems).toEqual([
      { problemId: problem.id, score: 40, attempts: 1 },
    ])
  })

  // Part of #50: a team removed by the organizer keeps its submissions for
  // audit, but must drop out of the leaderboard.
  it('excludes a removed team, while its submissions stay queryable', async () => {
    const problem = await insertProblem()
    const activeTeam = await insertTeam('Time A')
    const removedTeam = await insertTeam('Time B')
    const created = await createRound(db, {
      name: 'Rodada 1',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!created.ok) throw new Error('expected create to succeed')
    const opened = await openRound(db, created.round.id)
    if (!opened.ok) throw new Error('expected open to succeed')

    await submit(opened.round.id, activeTeam.id, problem.id, 100)
    await submit(opened.round.id, removedTeam.id, problem.id, 90)
    await db
      .update(teamsTable)
      .set({ removedAt: new Date() })
      .where(eq(teamsTable.id, removedTeam.id))

    const ranking = await getRoundRanking(db, opened.round.id)

    expect(ranking?.teams.map((team) => team.teamName)).toEqual(['Time A'])
    const [preserved] = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.teamId, removedTeam.id))
    expect(preserved).toBeDefined()
  })
})

describe('getEventRanking', () => {
  it('sums every non-draft round for each team', async () => {
    const problemA = await insertProblem()
    const problemB = await insertProblem()
    const teamA = await insertTeam('Time A')
    const teamB = await insertTeam('Time B')

    const firstRound = await createRound(db, {
      name: 'Rodada 1',
      durationMinutes: 30,
      problemIds: [problemA.id],
    })
    if (!firstRound.ok) throw new Error('expected create to succeed')
    const openedFirst = await openRound(db, firstRound.round.id)
    if (!openedFirst.ok) throw new Error('expected open to succeed')
    await submit(openedFirst.round.id, teamA.id, problemA.id, 100)
    await submit(openedFirst.round.id, teamB.id, problemA.id, 20)
    const closedFirst = await closeRound(db, firstRound.round.id)
    if (!closedFirst.ok) throw new Error('expected close to succeed')

    const secondRound = await createRound(db, {
      name: 'Rodada 2',
      durationMinutes: 30,
      problemIds: [problemB.id],
    })
    if (!secondRound.ok) throw new Error('expected create to succeed')
    const openedSecond = await openRound(db, secondRound.round.id)
    if (!openedSecond.ok) throw new Error('expected open to succeed')
    await submit(openedSecond.round.id, teamA.id, problemB.id, 30)
    await submit(openedSecond.round.id, teamB.id, problemB.id, 90)
    // secondRound stays open — the event ranking must include the active round too.

    const ranking = await getEventRanking(db)

    expect(ranking.teams.map((team) => [team.teamName, team.totalScore, team.rank])).toEqual([
      ['Time A', 130, 1],
      ['Time B', 110, 2],
    ])
    expect(ranking.teams[0]?.rounds).toEqual([
      {
        roundId: firstRound.round.id,
        roundName: 'Rodada 1',
        score: 100,
        attempts: 1,
        tiebreakTimeMs: expect.any(Number),
      },
      {
        roundId: secondRound.round.id,
        roundName: 'Rodada 2',
        score: 30,
        attempts: 1,
        tiebreakTimeMs: expect.any(Number),
      },
    ])
  })
})
