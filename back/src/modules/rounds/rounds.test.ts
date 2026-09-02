import { sql } from 'drizzle-orm'
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
import { createRound, getRound, listRounds, updateRound } from './rounds.service'

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
})
