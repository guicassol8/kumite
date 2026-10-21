import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  computeMissingLocales,
  evaluateTestCaseCoverage,
  getPublishedProblem,
  listPracticeProblems,
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
    // The seeded organizer is not a legacy account: it gets a name like any
    // other user, without a new env var to supply it (#122).
    expect(users[0]?.name).toBe('Organização kumite')

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

  // The organizer credentials are read on seed()'s first line, before any
  // query — a missing one must name itself instead of dumping a ZodError (#97).
  it('names the missing organizer variable and writes nothing', async () => {
    delete process.env.ORGANIZER_EMAIL

    try {
      await expect(seed(db)).rejects.toThrow(/ORGANIZER_EMAIL: required, but not set/)
      await expect(seed(db)).rejects.toThrow(/back\/\.env\.example/)
      expect(await db.select().from(usersTable)).toHaveLength(0)
    } finally {
      // beforeEach rewrites it, but an early failure above must not leak the
      // hole into the rest of the file.
      process.env['ORGANIZER_EMAIL'] = ORGANIZER_EMAIL
    }
  })

  it('preserves an event_config row the organizer already changed (#287)', async () => {
    // What production looks like after the organizer locked mixing and
    // resized teams: deploy.yml runs this seed on every release, and until
    // #287 it reset the row to the defaults. The suites' "known state" comes
    // from db/reset.ts now, never from here.
    await db.insert(eventConfigTable).values({ id: 1, mixingLocked: true, maxTeamSize: 6 })

    await seed(db)

    const eventConfig = await db.select().from(eventConfigTable)
    expect(eventConfig).toHaveLength(1)
    expect(eventConfig[0]?.mixingLocked).toBe(true)
    expect(eventConfig[0]?.maxTeamSize).toBe(6)
  })

  it('stays idempotent when run twice', async () => {
    await seed(db)
    await seed(db)

    expect(await db.select().from(usersTable)).toHaveLength(1)
    expect(await db.select().from(eventCodesTable)).toHaveLength(2)
    // 11 competition (#483) + 3 practice problems (#210), 3 locales each.
    expect(await db.select().from(problemsTable)).toHaveLength(14)
    expect(await db.select().from(problemTranslationsTable)).toHaveLength(42)

    const eventConfig = await db.select().from(eventConfigTable)
    expect(eventConfig).toHaveLength(1)
    expect(eventConfig[0]?.mixingLocked).toBe(false)
    expect(eventConfig[0]?.maxTeamSize).toBe(3)
  })
})

describe('problem seed', () => {
  it('creates 11 published problems with complete translations and covered test cases', async () => {
    await seed(db)

    const problems = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.visibility, 'round'))
    expect(problems).toHaveLength(11)

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

  it('covers all three difficulties: 3 easy, 3 medium, 5 hard (#483)', async () => {
    await seed(db)

    const problems = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.visibility, 'round'))
    const count = (difficulty: string) => problems.filter((p) => p.difficulty === difficulty).length
    expect([count('easy'), count('medium'), count('hard')]).toEqual([3, 3, 5])
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

describe('practice seed (#210)', () => {
  const practiceProblems = () =>
    db.select().from(problemsTable).where(eq(problemsTable.visibility, 'practice'))

  it('creates the three practice problems, published, each in pt/es/en', async () => {
    await seed(db)

    const problems = await practiceProblems()
    expect(problems).toHaveLength(3)

    const translations = await db.select().from(problemTranslationsTable)
    for (const problem of problems) {
      expect(problem.status).toBe('published')
      const locales = translations.filter((t) => t.problemId === problem.id).map((t) => t.locale)
      expect(computeMissingLocales(locales)).toEqual([])
      expect(evaluateTestCaseCoverage(problem.testCases, 'practice')).toBe('ok')
      expect(problem.testCases.every((tc) => !tc.hidden)).toBe(true)
    }
  })

  it('keeps exactly three practice problems when run twice', async () => {
    await seed(db)
    await seed(db)

    expect(await practiceProblems()).toHaveLength(3)
  })

  it('leaves the competition problems as round problems', async () => {
    await seed(db)

    const rounds = await db
      .select()
      .from(problemsTable)
      .where(eq(problemsTable.visibility, 'round'))
    expect(rounds).toHaveLength(11)
    for (const problem of rounds) expect(problem.status).toBe('published')
  })

  it('lists them in the order of the progression, in the requested locale', async () => {
    await seed(db)

    const listed = await listPracticeProblems(db, 'en')
    expect(listed.map((problem) => problem.title)).toEqual([
      'Return the input',
      'Is it even?',
      'Sum of the list',
    ])
    expect(listed.every((problem) => problem.locale === 'en')).toBe(true)
  })

  it.each([
    ['es', 'Devuelve la entrada'],
    ['en', 'Return the input'],
  ] as const)('serves the statement in %s without falling back to pt', async (locale, title) => {
    await seed(db)
    const [organizer] = await db.select().from(usersTable)
    const [first] = await listPracticeProblems(db, 'pt')

    const problem = await getPublishedProblem(db, first!.id, locale, organizer!.id)

    expect(problem?.locale).toBe(locale)
    expect(problem?.title).toBe(title)
    expect(problem?.visibility).toBe('practice')
  })

  // #212: the demo link is matched on the pt title, never on the locale being
  // served — reading in es still finds each problem's own demo.
  it('links every seeded practice problem to its demo, read in es', async () => {
    await seed(db)
    const [organizer] = await db.select().from(usersTable)
    const listed = await listPracticeProblems(db, 'pt')

    const keys = await Promise.all(
      listed.map(
        async (problem) =>
          (await getPublishedProblem(db, problem.id, 'es', organizer!.id))?.demoKey,
      ),
    )

    expect(keys).toEqual(['devolva-entrada', 'e-par', 'soma-lista'])
  })
})
