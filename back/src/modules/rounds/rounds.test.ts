import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import {
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import {
  closeRound,
  createRound,
  extendRound,
  getRound,
  listRounds,
  openRound,
  updateRound,
} from './rounds.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #35 migrations must already be applied.
const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${roundProblemsTable}, ${roundsTable}, ${problemTranslationsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
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
})
