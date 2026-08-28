import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { problemsTable, problemTranslationsTable } from '../../db/schema'
import { TestCaseSchema } from './problems.schema'

describe('TestCaseSchema', () => {
  it('accepts a valid test case', () => {
    const result = TestCaseSchema.safeParse({ input: [1, 2], expected: 3, hidden: false })
    expect(result.success).toBe(true)
  })

  it('rejects a non-boolean hidden flag', () => {
    const result = TestCaseSchema.safeParse({ input: 1, expected: 2, hidden: 'yes' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing input', () => {
    const result = TestCaseSchema.safeParse({ expected: 2, hidden: false })
    expect(result.success).toBe(false)
  })
})

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #9 migration must already be applied.
describe('problems and problem_translations tables', () => {
  const db = createDb()

  beforeEach(async () => {
    await db.execute(
      sql`truncate table ${problemTranslationsTable}, ${problemsTable} restart identity cascade`,
    )
  })

  afterAll(async () => {
    await db.$client.end()
  })

  it('defaults points to 100 when not provided', async () => {
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'draft' })
      .returning()

    expect(problem?.points).toBe(100)
  })

  it('rejects a second translation with the same problem_id and locale', async () => {
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'draft' })
      .returning()
    if (!problem) throw new Error('expected problem to be inserted')

    await db.insert(problemTranslationsTable).values({
      problemId: problem.id,
      locale: 'pt',
      title: 'Soma',
      statementMd: 'Some dois números.',
    })

    await expect(
      db.insert(problemTranslationsTable).values({
        problemId: problem.id,
        locale: 'pt',
        title: 'Soma (duplicada)',
        statementMd: 'Duplicada.',
      }),
    ).rejects.toThrow()
  })

  it('preserves test case order on read back', async () => {
    const testCases = [
      { input: 1, expected: 1, hidden: false },
      { input: 2, expected: 4, hidden: true },
      { input: 3, expected: 9, hidden: false },
    ]

    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'medium', status: 'draft', testCases })
      .returning()

    expect(problem?.testCases).toEqual(testCases)
  })
})
