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
