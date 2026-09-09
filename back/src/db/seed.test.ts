import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  computeMissingLocales,
  evaluateTestCaseCoverage,
} from '../modules/problems/problems.service'
import { createDb } from './client'
import {
  eventCodesTable,
  eventConfigTable,
  problemsTable,
  problemTranslationsTable,
  usersTable,
} from './schema'
import { seed } from './seed'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// migrations from #24's T3 must already be applied.
const db = createDb()

const ORGANIZER_EMAIL = 'organizer@example.com'
const ORGANIZER_PASSWORD = 'supersecret'

beforeEach(async () => {
  process.env['ORGANIZER_EMAIL'] = ORGANIZER_EMAIL
  process.env['ORGANIZER_PASSWORD'] = ORGANIZER_PASSWORD
  await db.execute(
    sql`truncate table ${usersTable}, ${eventCodesTable}, ${eventConfigTable}, ${problemsTable}, ${problemTranslationsTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

describe('seed', () => {
  it('creates the initial organizer and the PUCRS/Mérida event codes', async () => {
    await seed(db)

    const users = await db.select().from(usersTable)
    expect(users).toHaveLength(1)
    expect(users[0]?.email).toBe(ORGANIZER_EMAIL)
    expect(users[0]?.role).toBe('organizer')

    const eventCodes = await db.select().from(eventCodesTable)
    const pucrs = eventCodes.find((row) => row.code === 'PUCRS2026')
    const merida = eventCodes.find((row) => row.code === 'MERIDA2026')
    expect(eventCodes).toHaveLength(2)
    expect(pucrs?.allowedEmailSuffixes).toEqual(['edu.pucrs.br', 'pucrs.br'])
    expect(merida?.allowedEmailSuffixes).toEqual(['merida.edu.mx'])

    const eventConfig = await db.select().from(eventConfigTable)
    expect(eventConfig).toHaveLength(1)
    expect(eventConfig[0]?.mixingLocked).toBe(false)
    expect(eventConfig[0]?.maxTeamSize).toBe(3)
  })

  it('rejects a second user whose email differs only by case', async () => {
    await db.insert(usersTable).values({
      email: 'ada@example.com',
      passwordHash: 'hash',
      role: 'participant',
      university: 'pucrs',
    })

    await expect(
      db.insert(usersTable).values({
        email: 'Ada@Example.com',
        passwordHash: 'hash',
        role: 'participant',
        university: 'pucrs',
      }),
    ).rejects.toThrow()
  })

  it('resets a mutated event_config row back to the defaults', async () => {
    // Exactly the state the vitest suite leaves behind: the singleton row
    // exists and holds whatever the last test wrote to it.
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true, maxTeamSize: 6 })

    await seed(db)

    const eventConfig = await db.select().from(eventConfigTable)
    expect(eventConfig).toHaveLength(1)
    expect(eventConfig[0]?.mixingLocked).toBe(false)
    expect(eventConfig[0]?.maxTeamSize).toBe(3)
  })

  it('stays idempotent when run twice', async () => {
    await seed(db)
    await seed(db)

    expect(await db.select().from(usersTable)).toHaveLength(1)
    expect(await db.select().from(eventCodesTable)).toHaveLength(2)
    expect(await db.select().from(problemsTable)).toHaveLength(4)
    expect(await db.select().from(problemTranslationsTable)).toHaveLength(12)

    const eventConfig = await db.select().from(eventConfigTable)
    expect(eventConfig).toHaveLength(1)
    expect(eventConfig[0]?.mixingLocked).toBe(false)
    expect(eventConfig[0]?.maxTeamSize).toBe(3)
  })
})

describe('problem seed', () => {
  it('creates 4 published problems with complete translations and covered test cases', async () => {
    await seed(db)

    const problems = await db.select().from(problemsTable)
    expect(problems).toHaveLength(4)

    const translations = await db.select().from(problemTranslationsTable)
    const translationsByProblem = new Map<string, typeof translations>()
    for (const translation of translations) {
      const list = translationsByProblem.get(translation.problemId) ?? []
      list.push(translation)
      translationsByProblem.set(translation.problemId, list)
    }

    for (const problem of problems) {
      expect(problem.status).toBe('published')

      const problemTranslations = translationsByProblem.get(problem.id) ?? []
      const missingLocales = computeMissingLocales(problemTranslations.map((t) => t.locale))
      expect(missingLocales).toEqual([])

      expect(evaluateTestCaseCoverage(problem.testCases)).toBe('ok')
    }
  })

  it('covers all three difficulties', async () => {
    await seed(db)

    const problems = await db.select().from(problemsTable)
    const difficulties = new Set(problems.map((p) => p.difficulty))
    expect(difficulties).toEqual(new Set(['easy', 'medium', 'hard']))
  })

  it('includes the "Soma dos Pares" problem identical to the demo hardcode', async () => {
    await seed(db)

    const translations = await db
      .select()
      .from(problemTranslationsTable)
      .where(eq(problemTranslationsTable.locale, 'pt'))
    const somaDosPares = translations.find((t) => t.title === 'Soma dos Pares')
    expect(somaDosPares).toBeDefined()

    const [problem] = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.id, somaDosPares!.problemId))
    expect(problem?.testCases.filter((tc) => !tc.hidden)).toEqual([
      { input: [1, 2, 3, 4], expected: 6, hidden: false },
      { input: [5, 7, 9], expected: 0, hidden: false },
      { input: [2, 4, 6, 8], expected: 20, hidden: false },
    ])
  })
})
