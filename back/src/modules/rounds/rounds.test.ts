import { signJwt } from '@katajs-framework/core/jwt'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
import { createDb } from '../../db/client'
import {
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import { archiveProblem, getPublishedProblem } from '../problems/problems.service'
import {
  closeRound,
  createRound,
  extendRound,
  getParticipantRound,
  getProblemRoundAccess,
  getRound,
  isProblemInOpenRound,
  listParticipantRounds,
  listRounds,
  openRound,
  reapExpiredRound,
  updateRound,
} from './rounds.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #35 migrations must already be applied.
const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemTranslationsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

describe('rounds table', () => {
  it('is created as a draft with the given name and duration', async () => {
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 60 })
      .returning()

    expect(round).toMatchObject({ name: 'Round 1', durationMinutes: 60, status: 'draft' })
  })

  it('rejects a second round set to open while one is already open', async () => {
    await db.insert(roundsTable).values({ name: 'Round 1', durationMinutes: 60, status: 'open' })

    await expect(
      db.insert(roundsTable).values({ name: 'Round 2', durationMinutes: 60, status: 'open' }),
    ).rejects.toThrow()
  })
})

describe('round_problems table', () => {
  it('rejects an association with a problem that is not published', async () => {
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 60 })
      .returning()
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'draft' })
      .returning()
    if (!round || !problem) throw new Error('expected fixtures')

    await expect(
      db
        .insert(roundProblemsTable)
        .values({ roundId: round.id, problemId: problem.id, position: 0 }),
    ).rejects.toThrow()
  })

  it('accepts an association with a published problem', async () => {
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 60 })
      .returning()
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'published' })
      .returning()
    if (!round || !problem) throw new Error('expected fixtures')

    await expect(
      db
        .insert(roundProblemsTable)
        .values({ roundId: round.id, problemId: problem.id, position: 0 }),
    ).resolves.not.toThrow()
  })

  it('rejects two problems sharing the same position in a round', async () => {
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 60 })
      .returning()
    const [problemA] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'published' })
      .returning()
    const [problemB] = await db
      .insert(problemsTable)
      .values({ difficulty: 'medium', status: 'published' })
      .returning()
    if (!round || !problemA || !problemB) throw new Error('expected fixtures')
    await db
      .insert(roundProblemsTable)
      .values({ roundId: round.id, problemId: problemA.id, position: 0 })

    await expect(
      db
        .insert(roundProblemsTable)
        .values({ roundId: round.id, problemId: problemB.id, position: 0 }),
    ).rejects.toThrow()
  })
})

describe('rounds.service', () => {
  it('lazily closes an open round whose closesAt has passed, on getRound', async () => {
    const closesAt = new Date(Date.now() - 60_000)
    const [round] = await db
      .insert(roundsTable)
      .values({
        name: 'Round 1',
        durationMinutes: 30,
        status: 'open',
        openedAt: new Date(Date.now() - 120_000),
        closesAt,
      })
      .returning()
    if (!round) throw new Error('expected fixture')

    const detail = await getRound(db, round.id)

    expect(detail?.status).toBe('closed')
    expect(detail?.closedAt?.getTime()).toBe(closesAt.getTime())
  })

  it('leaves an open round untouched while closesAt is still in the future', async () => {
    const closesAt = new Date(Date.now() + 60_000)
    const [round] = await db
      .insert(roundsTable)
      .values({
        name: 'Round 1',
        durationMinutes: 30,
        status: 'open',
        openedAt: new Date(),
        closesAt,
      })
      .returning()
    if (!round) throw new Error('expected fixture')

    const detail = await getRound(db, round.id)

    expect(detail?.status).toBe('open')
  })

  it('lazily closes an expired open round on listRounds too', async () => {
    const closesAt = new Date(Date.now() - 60_000)
    await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 30, status: 'open', closesAt })

    const rounds = await listRounds(db)

    expect(rounds[0]?.status).toBe('closed')
  })

  it('returns null from getRound for an unknown id', async () => {
    expect(await getRound(db, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  describe('reapExpiredRound', () => {
    it('returns the closed round on the first call, and nothing on an immediate second call', async () => {
      const closesAt = new Date(Date.now() - 60_000)
      const [round] = await db
        .insert(roundsTable)
        .values({
          name: 'Round 1',
          durationMinutes: 30,
          status: 'open',
          openedAt: new Date(Date.now() - 120_000),
          closesAt,
        })
        .returning()
      if (!round) throw new Error('expected fixture')

      const first = await reapExpiredRound(db)
      const second = await reapExpiredRound(db)

      expect(first).toEqual([{ id: round.id, closesAt }])
      expect(second).toEqual([])
      const detail = await getRound(db, round.id)
      expect(detail?.status).toBe('closed')
    })

    it('returns nothing when there is no expired open round', async () => {
      expect(await reapExpiredRound(db)).toEqual([])
    })
  })

  it('getRound includes associated problems ordered by position, with problemCount on the summary', async () => {
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 30 })
      .returning()
    const [problemA] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'published' })
      .returning()
    const [problemB] = await db
      .insert(problemsTable)
      .values({ difficulty: 'medium', status: 'published' })
      .returning()
    if (!round || !problemA || !problemB) throw new Error('expected fixtures')
    await db.insert(roundProblemsTable).values([
      { roundId: round.id, problemId: problemB.id, position: 1 },
      { roundId: round.id, problemId: problemA.id, position: 0 },
    ])

    const detail = await getRound(db, round.id)
    const summaries = await listRounds(db)

    expect(detail?.problems).toEqual([
      { problemId: problemA.id, position: 0 },
      { problemId: problemB.id, position: 1 },
    ])
    expect(summaries.find((r) => r.id === round.id)?.problemCount).toBe(2)
  })

  describe('createRound', () => {
    it('creates a draft round with problems positioned by input order', async () => {
      const [problemA] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      const [problemB] = await db
        .insert(problemsTable)
        .values({ difficulty: 'medium', status: 'published' })
        .returning()
      if (!problemA || !problemB) throw new Error('expected fixtures')

      const result = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problemB.id, problemA.id],
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.round.status).toBe('draft')
      expect(result.round.problems).toEqual([
        { problemId: problemB.id, position: 0 },
        { problemId: problemA.id, position: 1 },
      ])
    })

    it('rejects with invalid_problem_ids and inserts nothing when an id is missing', async () => {
      const [problemA] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problemA) throw new Error('expected fixture')

      const result = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problemA.id, '00000000-0000-0000-0000-000000000000'],
      })

      expect(result).toEqual({ ok: false, error: 'invalid_problem_ids' })
      expect(await listRounds(db)).toEqual([])
    })

    it('rejects with invalid_problem_ids and inserts nothing when an id is not published', async () => {
      const [draftProblem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'draft' })
        .returning()
      if (!draftProblem) throw new Error('expected fixture')

      const result = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [draftProblem.id],
      })

      expect(result).toEqual({ ok: false, error: 'invalid_problem_ids' })
      expect(await listRounds(db)).toEqual([])
    })
  })

  describe('updateRound', () => {
    it('returns not_found for an unknown id', async () => {
      const result = await updateRound(db, '00000000-0000-0000-0000-000000000000', { name: 'X' })
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })

    it('rejects with round_not_draft when the round is not a draft', async () => {
      const [round] = await db
        .insert(roundsTable)
        .values({
          name: 'Round 1',
          durationMinutes: 30,
          status: 'open',
          closesAt: new Date(Date.now() + 60_000),
        })
        .returning()
      if (!round) throw new Error('expected fixture')

      const result = await updateRound(db, round.id, { name: 'New name' })

      expect(result).toEqual({ ok: false, error: 'round_not_draft' })
    })

    it('patches name and durationMinutes on a draft round', async () => {
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      const result = await updateRound(db, created.round.id, {
        name: 'Round 1 (renamed)',
        durationMinutes: 45,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.round.name).toBe('Round 1 (renamed)')
      expect(result.round.durationMinutes).toBe(45)
    })

    it('replaces the problem list wholesale when problemIds is provided', async () => {
      const [problemA] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      const [problemB] = await db
        .insert(problemsTable)
        .values({ difficulty: 'medium', status: 'published' })
        .returning()
      if (!problemA || !problemB) throw new Error('expected fixtures')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problemA.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      const result = await updateRound(db, created.round.id, { problemIds: [problemB.id] })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.round.problems).toEqual([{ problemId: problemB.id, position: 0 }])
    })

    it('rejects with invalid_problem_ids and leaves the existing list untouched', async () => {
      const [problemA] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problemA) throw new Error('expected fixture')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problemA.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      const result = await updateRound(db, created.round.id, {
        problemIds: ['00000000-0000-0000-0000-000000000000'],
      })

      expect(result).toEqual({ ok: false, error: 'invalid_problem_ids' })
      const detail = await getRound(db, created.round.id)
      expect(detail?.problems).toEqual([{ problemId: problemA.id, position: 0 }])
    })
  })

  describe('openRound', () => {
    const createWithOnePublishedProblem = async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problem) throw new Error('expected fixture')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      return created.round
    }

    it('returns not_found for an unknown id', async () => {
      const result = await openRound(db, '00000000-0000-0000-0000-000000000000')
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })

    it('rejects with no_problems for a draft round with no problems', async () => {
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      const result = await openRound(db, created.round.id)

      expect(result).toEqual({ ok: false, error: 'no_problems' })
    })

    it('rejects with another_round_open when a different round is already open', async () => {
      const alreadyOpen = await createWithOnePublishedProblem()
      const firstOpen = await openRound(db, alreadyOpen.id)
      expect(firstOpen.ok).toBe(true)

      const other = await createWithOnePublishedProblem()
      const result = await openRound(db, other.id)

      expect(result).toEqual({ ok: false, error: 'another_round_open' })
    })

    it('rejects with round_not_draft when the round is already closed', async () => {
      const round = await createWithOnePublishedProblem()
      await db.update(roundsTable).set({ status: 'closed' }).where(eq(roundsTable.id, round.id))

      const result = await openRound(db, round.id)

      expect(result).toEqual({ ok: false, error: 'round_not_draft' })
    })

    it('opens a draft round, setting openedAt and closesAt = openedAt + durationMinutes', async () => {
      const round = await createWithOnePublishedProblem()
      const before = Date.now()

      const result = await openRound(db, round.id)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.round.status).toBe('open')
      const openedAt = result.round.openedAt?.getTime() ?? 0
      const closesAt = result.round.closesAt?.getTime() ?? 0
      expect(openedAt).toBeGreaterThanOrEqual(before)
      expect(closesAt - openedAt).toBe(30 * 60_000)
    })

    it('under a concurrent open on two different draft rounds, one wins and the other gets another_round_open (not a thrown error)', async () => {
      const first = await createWithOnePublishedProblem()
      const second = await createWithOnePublishedProblem()

      const results = await Promise.all([openRound(db, first.id), openRound(db, second.id)])

      const opened = results.filter((r) => r.ok)
      const rejected = results.filter((r) => !r.ok)
      expect(opened).toHaveLength(1)
      expect(rejected).toEqual([{ ok: false, error: 'another_round_open' }])
    })
  })

  describe('extendRound', () => {
    const createOpenRound = async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problem) throw new Error('expected fixture')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      return opened.round
    }

    it('returns not_found for an unknown id', async () => {
      const result = await extendRound(db, '00000000-0000-0000-0000-000000000000', 10)
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })

    it('rejects with round_not_open for a draft round', async () => {
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      const result = await extendRound(db, created.round.id, 10)

      expect(result).toEqual({ ok: false, error: 'round_not_open' })
    })

    it('rejects with round_not_open for a closed round', async () => {
      const round = await createOpenRound()
      await db.update(roundsTable).set({ status: 'closed' }).where(eq(roundsTable.id, round.id))

      const result = await extendRound(db, round.id, 10)

      expect(result).toEqual({ ok: false, error: 'round_not_open' })
    })

    it('adds the given minutes to closesAt on an open round', async () => {
      const round = await createOpenRound()
      const originalClosesAt = round.closesAt?.getTime() ?? 0

      const result = await extendRound(db, round.id, 15)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.round.closesAt?.getTime()).toBe(originalClosesAt + 15 * 60_000)
    })
  })

  describe('listParticipantRounds', () => {
    it('excludes draft rounds and sorts open-first, then closed newest-first', async () => {
      await db.insert(roundsTable).values({ name: 'Draft', durationMinutes: 30 })
      const [olderClosed] = await db
        .insert(roundsTable)
        .values({
          name: 'Older closed',
          durationMinutes: 30,
          status: 'closed',
          closedAt: new Date(Date.now() - 120_000),
        })
        .returning()
      const [newerClosed] = await db
        .insert(roundsTable)
        .values({
          name: 'Newer closed',
          durationMinutes: 30,
          status: 'closed',
          closedAt: new Date(Date.now() - 60_000),
        })
        .returning()
      const [open] = await db
        .insert(roundsTable)
        .values({
          name: 'Open',
          durationMinutes: 30,
          status: 'open',
          openedAt: new Date(),
          closesAt: new Date(Date.now() + 60_000),
        })
        .returning()
      if (!olderClosed || !newerClosed || !open) throw new Error('expected fixtures')

      const result = await listParticipantRounds(db)

      expect(result.map((r) => r.id)).toEqual([open.id, newerClosed.id, olderClosed.id])
    })

    it('counts only published problems for the participant, all of them for the organizer (#196)', async () => {
      const problems = await db
        .insert(problemsTable)
        .values([
          { difficulty: 'easy', status: 'published' },
          { difficulty: 'easy', status: 'published' },
        ])
        .returning()
      const [first, second] = problems
      if (!first || !second) throw new Error('expected fixtures')
      await db.insert(problemTranslationsTable).values(
        problems.map((p) => ({
          problemId: p.id,
          locale: 'pt' as const,
          title: 'T',
          statementMd: 'x',
        })),
      )
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [first.id, second.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      await archiveProblem(db, first.id)

      const participant = await listParticipantRounds(db)
      const organizer = await listRounds(db)

      expect(participant.find((r) => r.id === created.round.id)?.problemCount).toBe(1)
      expect(organizer.find((r) => r.id === created.round.id)?.problemCount).toBe(2)
    })
  })

  describe('getProblemRoundAccess', () => {
    const insertPublishedProblem = async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problem) throw new Error('expected fixture')
      return problem
    }

    it("returns 'none' for a problem in no round", async () => {
      const problem = await insertPublishedProblem()

      expect(await getProblemRoundAccess(db, problem.id)).toEqual({ status: 'none' })
    })

    it("returns 'none' for a problem only in a draft round", async () => {
      const problem = await insertPublishedProblem()
      await createRound(db, { name: 'Round 1', durationMinutes: 30, problemIds: [problem.id] })

      expect(await getProblemRoundAccess(db, problem.id)).toEqual({ status: 'none' })
    })

    it("returns 'closed' for a problem only in a closed round", async () => {
      const problem = await insertPublishedProblem()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      const closed = await closeRound(db, created.round.id)
      if (!closed.ok) throw new Error('expected close to succeed')

      expect(await getProblemRoundAccess(db, problem.id)).toEqual({
        status: 'closed',
        roundId: created.round.id,
      })
    })

    // #176: a reused problem sits in several closed rounds, and the score the
    // problem page shows has to belong to one of them — the round the
    // participant has just played.
    it("returns 'closed' with the most recently opened round for a reused problem", async () => {
      const problem = await insertPublishedProblem()

      const first = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!first.ok) throw new Error('expected create to succeed')
      const openedFirst = await openRound(db, first.round.id)
      if (!openedFirst.ok) throw new Error('expected open to succeed')
      const closedFirst = await closeRound(db, first.round.id)
      if (!closedFirst.ok) throw new Error('expected close to succeed')

      const second = await createRound(db, {
        name: 'Round 2',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!second.ok) throw new Error('expected create to succeed')
      const openedSecond = await openRound(db, second.round.id)
      if (!openedSecond.ok) throw new Error('expected open to succeed')
      const closedSecond = await closeRound(db, second.round.id)
      if (!closedSecond.ok) throw new Error('expected close to succeed')

      expect(await getProblemRoundAccess(db, problem.id)).toEqual({
        status: 'closed',
        roundId: second.round.id,
      })
    })

    it("returns 'open' with the roundId for a problem in an open round", async () => {
      const problem = await insertPublishedProblem()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')

      expect(await getProblemRoundAccess(db, problem.id)).toEqual({
        status: 'open',
        roundId: created.round.id,
      })
    })

    it('prefers the open round when the problem is also in a separate closed round', async () => {
      const problem = await insertPublishedProblem()
      const closedCreated = await createRound(db, {
        name: 'Closed round',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!closedCreated.ok) throw new Error('expected create to succeed')
      const closedOpened = await openRound(db, closedCreated.round.id)
      if (!closedOpened.ok) throw new Error('expected open to succeed')
      const closedClosed = await closeRound(db, closedCreated.round.id)
      if (!closedClosed.ok) throw new Error('expected close to succeed')

      const openCreated = await createRound(db, {
        name: 'Open round',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!openCreated.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, openCreated.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')

      expect(await getProblemRoundAccess(db, problem.id)).toEqual({
        status: 'open',
        roundId: openCreated.round.id,
      })
    })
  })

  describe('isProblemInOpenRound', () => {
    const createOpenRoundWithProblem = async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problem) throw new Error('expected fixture')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      return { round: opened.round, problem }
    }

    it('is true for the exact open round and problem pair', async () => {
      const { round, problem } = await createOpenRoundWithProblem()

      expect(await isProblemInOpenRound(db, round.id, problem.id)).toBe(true)
    })

    it('is false for a mismatched roundId', async () => {
      const { problem } = await createOpenRoundWithProblem()

      expect(
        await isProblemInOpenRound(db, '00000000-0000-0000-0000-000000000000', problem.id),
      ).toBe(false)
    })

    it('is false once the round has passed closesAt, even before any other read reaped it', async () => {
      const { round, problem } = await createOpenRoundWithProblem()
      await db
        .update(roundsTable)
        .set({ closesAt: new Date(Date.now() - 1000) })
        .where(eq(roundsTable.id, round.id))

      expect(await isProblemInOpenRound(db, round.id, problem.id)).toBe(false)
    })
  })

  describe('closeRound', () => {
    const createOpenRound = async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published' })
        .returning()
      if (!problem) throw new Error('expected fixture')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      return opened.round
    }

    it('returns not_found for an unknown id', async () => {
      const result = await closeRound(db, '00000000-0000-0000-0000-000000000000')
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })

    it('rejects with round_not_open for a draft round', async () => {
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      const result = await closeRound(db, created.round.id)

      expect(result).toEqual({ ok: false, error: 'round_not_open' })
    })

    it('closes an open round immediately, leaving closesAt untouched', async () => {
      const round = await createOpenRound()
      const originalClosesAt = round.closesAt?.getTime() ?? 0
      const before = Date.now()

      const result = await closeRound(db, round.id)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.round.status).toBe('closed')
      expect(result.round.closedAt?.getTime()).toBeGreaterThanOrEqual(before)
      expect(result.round.closesAt?.getTime()).toBe(originalClosesAt)
    })

    it('rejects with round_not_open on an already-closed round', async () => {
      const round = await createOpenRound()
      const first = await closeRound(db, round.id)
      expect(first.ok).toBe(true)

      const result = await closeRound(db, round.id)

      expect(result).toEqual({ ok: false, error: 'round_not_open' })
    })
  })

  describe('getParticipantRound', () => {
    async function insertUser() {
      const [user] = await db
        .insert(usersTable)
        .values({
          email: `participant-${crypto.randomUUID()}@example.com`,
          passwordHash: 'hash',
          role: 'participant',
          university: 'pucrs',
        })
        .returning()
      if (!user) throw new Error('expected fixture')
      return user
    }

    async function insertTeamFor(userId: string) {
      const [team] = await db
        .insert(teamsTable)
        .values({ name: `Team ${crypto.randomUUID()}` })
        .returning()
      if (!team) throw new Error('expected fixture')
      await db.insert(teamMembersTable).values({ userId, teamId: team.id })
      return team
    }

    async function insertPublishedProblemWithTranslations(
      overrides: { points?: number; missingEs?: boolean } = {},
    ) {
      const [problem] = await db
        .insert(problemsTable)
        .values({
          difficulty: 'easy',
          status: 'published',
          points: overrides.points ?? 10,
        })
        .returning()
      if (!problem) throw new Error('expected fixture')

      const translations = [
        { problemId: problem.id, locale: 'pt' as const, title: 'Soma', statementMd: 'x' },
        { problemId: problem.id, locale: 'en' as const, title: 'Sum', statementMd: 'x' },
        ...(overrides.missingEs
          ? []
          : [{ problemId: problem.id, locale: 'es' as const, title: 'Suma', statementMd: 'x' }]),
      ]
      await db.insert(problemTranslationsTable).values(translations)
      return problem
    }

    async function insertSubmission(
      roundId: string,
      teamId: string,
      userId: string,
      problemId: string,
      score: number,
      attemptNumber: number,
    ) {
      await db.insert(submissionsTable).values({
        problemId,
        roundId,
        userId,
        teamId,
        workspace: {},
        generatedCode: '// generated',
        score,
        attemptNumber,
        acceptedAt: new Date(),
      })
    }

    it('returns null for an unknown id', async () => {
      const user = await insertUser()

      expect(
        await getParticipantRound(db, '00000000-0000-0000-0000-000000000000', 'pt', user.id),
      ).toBeNull()
    })

    it('returns null for a draft round', async () => {
      const user = await insertUser()
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      expect(await getParticipantRound(db, created.round.id, 'pt', user.id)).toBeNull()
    })

    it('reports the team best score while the round is open', async () => {
      const user = await insertUser()
      const team = await insertTeamFor(user.id)
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      await insertSubmission(opened.round.id, team.id, user.id, problem.id, 7, 1)

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.status).toBe('open')
      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: 7 }),
      ])
    })

    it('reflects a better submission sent while the round is open', async () => {
      const user = await insertUser()
      const team = await insertTeamFor(user.id)
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      await insertSubmission(opened.round.id, team.id, user.id, problem.id, 3, 1)
      await insertSubmission(opened.round.id, team.id, user.id, problem.id, 8, 2)

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: 8 }),
      ])
    })

    it('reports bestScore null while open when the team never submitted', async () => {
      const user = await insertUser()
      await insertTeamFor(user.id)
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: null }),
      ])
    })

    it('reports bestScore null while open when the user has no team at all', async () => {
      const user = await insertUser()
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: null }),
      ])
    })

    it('reports the real best score (score desc, earliest createdAt on a tie) once the round is closed', async () => {
      const user = await insertUser()
      const team = await insertTeamFor(user.id)
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      await insertSubmission(opened.round.id, team.id, user.id, problem.id, 4, 1)
      await insertSubmission(opened.round.id, team.id, user.id, problem.id, 9, 2)
      await insertSubmission(opened.round.id, team.id, user.id, problem.id, 9, 3)
      const closed = await closeRound(db, created.round.id)
      if (!closed.ok) throw new Error('expected close to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.status).toBe('closed')
      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: 9 }),
      ])
    })

    it('reports bestScore null once closed when the team never submitted', async () => {
      const user = await insertUser()
      await insertTeamFor(user.id)
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      const closed = await closeRound(db, created.round.id)
      if (!closed.ok) throw new Error('expected close to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: null }),
      ])
    })

    it('reports bestScore null once closed when the user has no team at all', async () => {
      const user = await insertUser()
      const problem = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      const closed = await closeRound(db, created.round.id)
      if (!closed.ok) throw new Error('expected close to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.problems).toEqual([
        expect.objectContaining({ problemId: problem.id, bestScore: null }),
      ])
    })

    it('falls back to the pt title when the requested locale has no translation', async () => {
      const user = await insertUser()
      const problem = await insertPublishedProblemWithTranslations({ missingEs: true })
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'es', user.id)

      expect(detail?.problems[0]?.title).toBe('Soma')
    })

    it('orders problems by position regardless of insertion order', async () => {
      const user = await insertUser()
      const problemA = await insertPublishedProblemWithTranslations()
      const problemB = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problemB.id, problemA.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')

      const detail = await getParticipantRound(db, created.round.id, 'pt', user.id)

      expect(detail?.problems.map((p) => p.problemId)).toEqual([problemB.id, problemA.id])
    })

    // #196: an archived problem 404s on GET /problems/:id, so the round
    // listing must drop it too — keeping the survivors' original position.
    async function roundWithTwoProblems() {
      const user = await insertUser()
      const team = await insertTeamFor(user.id)
      const problemA = await insertPublishedProblemWithTranslations()
      const problemB = await insertPublishedProblemWithTranslations()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problemA.id, problemB.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      const positionOf = new Map(created.round.problems.map((p) => [p.problemId, p.position]))
      return { user, team, problemA, problemB, roundId: created.round.id, positionOf }
    }

    it('drops a problem archived while the round is open, keeping the original position (#196)', async () => {
      const { user, team, problemA, problemB, roundId, positionOf } = await roundWithTwoProblems()
      await insertSubmission(roundId, team.id, user.id, problemB.id, 7, 1)
      await archiveProblem(db, problemA.id)

      const detail = await getParticipantRound(db, roundId, 'pt', user.id)

      expect(detail?.problems).toEqual([
        expect.objectContaining({
          problemId: problemB.id,
          position: positionOf.get(problemB.id),
          bestScore: 7,
        }),
      ])
    })

    it('drops an archived problem from a closed round too (#196)', async () => {
      const { user, problemA, problemB, roundId } = await roundWithTwoProblems()
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected close to succeed')
      await archiveProblem(db, problemA.id)

      const detail = await getParticipantRound(db, roundId, 'pt', user.id)

      expect(detail?.status).toBe('closed')
      expect(detail?.problems.map((p) => p.problemId)).toEqual([problemB.id])
    })

    it('still returns the round with an empty list when every problem is archived (#196)', async () => {
      const { user, problemA, problemB, roundId } = await roundWithTwoProblems()
      await archiveProblem(db, problemA.id)
      await archiveProblem(db, problemB.id)

      const detail = await getParticipantRound(db, roundId, 'pt', user.id)

      expect(detail).not.toBeNull()
      expect(detail?.problems).toEqual([])
    })

    it('only lists problems whose detail GET /problems/:id serves (#196)', async () => {
      const { user, problemA, roundId } = await roundWithTwoProblems()
      await archiveProblem(db, problemA.id)

      const detail = await getParticipantRound(db, roundId, 'pt', user.id)

      expect(detail?.problems.length).toBeGreaterThan(0)
      for (const listed of detail?.problems ?? []) {
        expect(await getPublishedProblem(db, listed.problemId, 'pt', user.id)).not.toBeNull()
      }
    })
  })
})

describe('rounds.route — GET /rounds (participant, #40)', () => {
  async function tokenForParticipant() {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: `participant-${crypto.randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'participant',
        university: 'pucrs',
      })
      .returning()
    if (!user) throw new Error('expected fixture')
    return signJwt(
      { role: user.role, university: user.university },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  it('returns open and closed rounds, excluding drafts, for an authenticated participant', async () => {
    const token = await tokenForParticipant()
    await db.insert(roundsTable).values({ name: 'Draft', durationMinutes: 30 })
    const [closed] = await db
      .insert(roundsTable)
      .values({ name: 'Closed', durationMinutes: 30, status: 'closed', closedAt: new Date() })
      .returning()
    if (!closed) throw new Error('expected fixture')

    const res = await app.request('/rounds', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string }[]
    expect(body.map((r) => r.id)).toEqual([closed.id])
  })

  it('returns 401 without a token', async () => {
    const res = await app.request('/rounds')
    expect(res.status).toBe(401)
  })
})

describe('rounds.route — publishes to the sse bus on lifecycle transitions (#38)', () => {
  async function tokenForOrganizer() {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: `organizer-${crypto.randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'organizer',
        university: 'pucrs',
      })
      .returning()
    if (!user) throw new Error('expected fixture')
    return signJwt(
      { role: user.role, university: user.university },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  async function createDraftRoundWithProblem() {
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'published' })
      .returning()
    if (!problem) throw new Error('expected fixture')
    const created = await createRound(db, {
      name: 'Round 1',
      durationMinutes: 30,
      problemIds: [problem.id],
    })
    if (!created.ok) throw new Error('expected create to succeed')
    return created.round
  }

  it('publishes round.opened synchronously when open succeeds', async () => {
    const token = await tokenForOrganizer()
    const round = await createDraftRoundWithProblem()
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await app.request(`/organizer/rounds/${round.id}/open`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'round.opened', roundId: round.id }),
    )
    unsubscribe()
  })

  it('publishes round.extended synchronously when extend succeeds', async () => {
    const token = await tokenForOrganizer()
    const round = await createDraftRoundWithProblem()
    const opened = await openRound(db, round.id)
    if (!opened.ok) throw new Error('expected open to succeed')
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await app.request(`/organizer/rounds/${round.id}/extend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 5 }),
    })

    expect(res.status).toBe(200)
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'round.extended', roundId: round.id }),
    )
    unsubscribe()
  })

  it('publishes round.closed synchronously when close succeeds', async () => {
    const token = await tokenForOrganizer()
    const round = await createDraftRoundWithProblem()
    const opened = await openRound(db, round.id)
    if (!opened.ok) throw new Error('expected open to succeed')
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await app.request(`/organizer/rounds/${round.id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'round.closed', roundId: round.id }),
    )
    unsubscribe()
  })

  it('does not publish when open fails (round not draft)', async () => {
    const token = await tokenForOrganizer()
    const round = await createDraftRoundWithProblem()
    const opened = await openRound(db, round.id)
    if (!opened.ok) throw new Error('expected open to succeed')
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await app.request(`/organizer/rounds/${round.id}/open`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(409)
    expect(fn).not.toHaveBeenCalled()
    unsubscribe()
  })
})
