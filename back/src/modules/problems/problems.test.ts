import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

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
import { closeRound, createRound, openRound } from '../rounds/rounds.service'
import {
  ParticipantProblemParamsSchema,
  ParticipantProblemQuerySchema,
  ParticipantProblemSchema,
  TestCaseSchema,
  UpdateProblemBodySchema,
} from './problems.schema'
import {
  archiveProblem,
  computeMissingLocales,
  createProblem,
  evaluateTestCaseCoverage,
  getProblem,
  getPublishedProblem,
  listProblems,
  publishProblem,
  updateProblem,
} from './problems.service'

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

describe('UpdateProblemBodySchema', () => {
  it('rejects duplicate locales in the same translations array', () => {
    const result = UpdateProblemBodySchema.safeParse({
      translations: [
        { locale: 'pt', title: 'Soma', statementMd: 'a' },
        { locale: 'pt', title: 'Soma 2', statementMd: 'b' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts distinct locales in the same translations array', () => {
    const result = UpdateProblemBodySchema.safeParse({
      translations: [
        { locale: 'pt', title: 'Soma', statementMd: 'a' },
        { locale: 'es', title: 'Suma', statementMd: 'b' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('ParticipantProblemQuerySchema', () => {
  it('defaults the locale to pt when the query param is absent', () => {
    expect(ParticipantProblemQuerySchema.parse({})).toEqual({ locale: 'pt' })
  })

  it('accepts a supported locale', () => {
    expect(ParticipantProblemQuerySchema.parse({ locale: 'es' })).toEqual({ locale: 'es' })
  })

  it('rejects an unsupported locale, naming the supported ones', () => {
    const result = ParticipantProblemQuerySchema.safeParse({ locale: 'de' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("'pt' | 'es' | 'en'")
    }
  })
})

describe('ParticipantProblemParamsSchema', () => {
  it('accepts a uuid', () => {
    const id = '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11'
    expect(ParticipantProblemParamsSchema.parse({ id })).toEqual({ id })
  })

  it('rejects a malformed id', () => {
    expect(ParticipantProblemParamsSchema.safeParse({ id: 'abc' }).success).toBe(false)
  })
})

describe('ParticipantProblemSchema', () => {
  // Second line of defence against leaking hidden cases: kata re-validates the
  // handler's output against this schema, and zod strips what it does not declare.
  it('strips a hidden flag smuggled into an example case', () => {
    const parsed = ParticipantProblemSchema.parse({
      id: '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      points: 100,
      difficulty: 'easy',
      locale: 'pt',
      title: 'Soma',
      statementMd: 'Some dois números.',
      examples: [{ input: [1, 2], expected: 3, hidden: true }],
      roundId: null,
      roundStatus: 'closed',
      bestSubmission: null,
    })

    expect(parsed.examples[0]).toEqual({ input: [1, 2], expected: 3 })
    expect(JSON.stringify(parsed)).not.toContain('hidden')
  })

  it('accepts an open round with a bestSubmission', () => {
    const parsed = ParticipantProblemSchema.parse({
      id: '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      points: 100,
      difficulty: 'easy',
      locale: 'pt',
      title: 'Soma',
      statementMd: 'Some dois números.',
      examples: [],
      roundId: '9f3f1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      roundStatus: 'open',
      bestSubmission: { score: 80, achievedAt: new Date().toISOString(), attempts: 2 },
    })

    expect(parsed.roundStatus).toBe('open')
    expect(parsed.bestSubmission).toMatchObject({ score: 80, attempts: 2 })
  })
})

describe('computeMissingLocales', () => {
  it('returns every locale missing from the input', () => {
    expect(computeMissingLocales(['pt'])).toEqual(['es', 'en'])
  })

  it('returns an empty array when all locales are present', () => {
    expect(computeMissingLocales(['pt', 'es', 'en'])).toEqual([])
  })
})

describe('evaluateTestCaseCoverage', () => {
  it('returns ok when at least one visible and one hidden case exist', () => {
    const result = evaluateTestCaseCoverage([
      { input: 1, expected: 1, hidden: false },
      { input: 2, expected: 2, hidden: true },
    ])
    expect(result).toBe('ok')
  })

  it('returns missing_hidden when only visible cases exist', () => {
    const result = evaluateTestCaseCoverage([{ input: 1, expected: 1, hidden: false }])
    expect(result).toBe('missing_hidden')
  })

  it('returns missing_visible when only hidden cases exist', () => {
    const result = evaluateTestCaseCoverage([{ input: 1, expected: 1, hidden: true }])
    expect(result).toBe('missing_visible')
  })

  it('returns missing_both when there are no test cases', () => {
    expect(evaluateTestCaseCoverage([])).toBe('missing_both')
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

describe('problems.service', () => {
  const db = createDb()

  beforeEach(async () => {
    await db.execute(
      sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemTranslationsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
    )
  })

  afterAll(async () => {
    await db.$client.end()
  })

  const visibleCase = { input: 1, expected: 1, hidden: false }
  const hiddenCase = { input: 2, expected: 2, hidden: true }

  it('creates a problem as a draft, defaulting points to 100', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })

    expect(problem.status).toBe('draft')
    expect(problem.points).toBe(100)
    expect(problem.testCases).toEqual([])
    expect(problem.translations).toEqual([])
  })

  it('creates a problem with an explicit points value', async () => {
    const problem = await createProblem(db, { difficulty: 'hard', points: 250 })
    expect(problem.points).toBe(250)
  })

  it('returns null from getProblem for an unknown id', async () => {
    expect(await getProblem(db, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('upserts a single locale via updateProblem without touching others already present', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await updateProblem(db, problem.id, {
      translations: [{ locale: 'pt', title: 'Soma', statementMd: 'Some dois números.' }],
    })

    const updated = await updateProblem(db, problem.id, {
      translations: [{ locale: 'es', title: 'Suma', statementMd: 'Suma dos números.' }],
    })

    expect(updated?.translations).toHaveLength(2)
    expect(updated?.translations.find((t) => t.locale === 'pt')?.title).toBe('Soma')
    expect(updated?.translations.find((t) => t.locale === 'es')?.title).toBe('Suma')
  })

  it('returns null from updateProblem for an unknown id', async () => {
    const result = await updateProblem(db, '00000000-0000-0000-0000-000000000000', {
      difficulty: 'hard',
    })
    expect(result).toBeNull()
  })

  it('replaces testCases wholesale', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await updateProblem(db, problem.id, { testCases: [visibleCase, hiddenCase] })

    const updated = await updateProblem(db, problem.id, { testCases: [visibleCase] })

    expect(updated?.testCases).toEqual([visibleCase])
  })

  const fullyTranslate = async (problemId: string) =>
    updateProblem(db, problemId, {
      translations: [
        { locale: 'pt', title: 'Soma', statementMd: 'a' },
        { locale: 'es', title: 'Suma', statementMd: 'b' },
        { locale: 'en', title: 'Sum', statementMd: 'c' },
      ],
    })

  it('publishProblem rejects with the missing locales when translations are incomplete', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await updateProblem(db, problem.id, {
      translations: [{ locale: 'pt', title: 'Soma', statementMd: 'a' }],
    })

    const result = await publishProblem(db, problem.id)

    expect(result).toEqual({
      ok: false,
      error: 'incomplete_translations',
      missingLocales: ['es', 'en'],
    })
  })

  it('publishProblem rejects with missing_hidden when no case is hidden', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await fullyTranslate(problem.id)
    await updateProblem(db, problem.id, { testCases: [visibleCase] })

    const result = await publishProblem(db, problem.id)

    expect(result).toEqual({ ok: false, error: 'missing_test_cases', reason: 'missing_hidden' })
  })

  it('publishProblem succeeds and is idempotent for a fully-qualified problem', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await fullyTranslate(problem.id)
    await updateProblem(db, problem.id, { testCases: [visibleCase, hiddenCase] })

    const first = await publishProblem(db, problem.id)
    const second = await publishProblem(db, problem.id)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (first.ok) expect(first.problem.status).toBe('published')
    if (second.ok) expect(second.problem.status).toBe('published')
  })

  it('publishProblem rejects an archived problem', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await fullyTranslate(problem.id)
    await updateProblem(db, problem.id, { testCases: [visibleCase, hiddenCase] })
    await archiveProblem(db, problem.id)

    const result = await publishProblem(db, problem.id)

    expect(result).toEqual({ ok: false, error: 'archived_problem' })
  })

  it('publishProblem returns not_found for an unknown id', async () => {
    const result = await publishProblem(db, '00000000-0000-0000-0000-000000000000')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('archiveProblem is idempotent and returns null for an unknown id', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })

    const first = await archiveProblem(db, problem.id)
    const second = await archiveProblem(db, problem.id)

    expect(first?.status).toBe('archived')
    expect(second?.status).toBe('archived')
    expect(await archiveProblem(db, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('listProblems orders by createdAt desc with the right testCaseCount', async () => {
    const first = await createProblem(db, { difficulty: 'easy' })
    const second = await createProblem(db, { difficulty: 'hard' })
    await updateProblem(db, second.id, { testCases: [visibleCase, hiddenCase] })

    const summaries = await listProblems(db)

    expect(summaries.map((p) => p.id)).toEqual([second.id, first.id])
    expect(summaries.find((p) => p.id === second.id)?.testCaseCount).toBe(2)
    expect(summaries.find((p) => p.id === first.id)?.testCaseCount).toBe(0)
  })

  describe('getPublishedProblem', () => {
    // A hidden expected value distinctive enough that a leak cannot hide in a
    // uuid or a points value.
    const secretExpected = 'RESPOSTA-OCULTA'

    const createSampleProblem = async () => {
      const problem = await createProblem(db, { difficulty: 'medium', points: 150 })
      await updateProblem(db, problem.id, {
        translations: [
          { locale: 'pt', title: 'Soma', statementMd: 'Some dois números.' },
          { locale: 'es', title: 'Suma', statementMd: 'Suma dos números.' },
          { locale: 'en', title: 'Sum', statementMd: 'Sum two numbers.' },
        ],
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [40, 2], expected: secretExpected, hidden: true },
        ],
      })
      const published = await publishProblem(db, problem.id)
      if (!published.ok) throw new Error('expected the sample problem to publish')
      return problem.id
    }

    // Most tests below care about the problem/translation/examples shape, not
    // round access — so this default puts the sample in an open round, the
    // one state that lets getPublishedProblem return non-null.
    const publishSample = async () => {
      const id = await createSampleProblem()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      return { id, roundId: created.round.id }
    }

    const insertUser = async (email = `participant-${crypto.randomUUID()}@edu.pucrs.br`) => {
      const [user] = await db
        .insert(usersTable)
        .values({ email, passwordHash: 'hash', role: 'participant', university: 'pucrs' })
        .returning()
      if (!user) throw new Error('expected a user fixture')
      return user
    }

    const insertTeamMember = async (userId: string, teamName = 'Time A') => {
      const [team] = await db.insert(teamsTable).values({ name: teamName }).returning()
      if (!team) throw new Error('expected a team fixture')
      await db.insert(teamMembersTable).values({ userId, teamId: team.id })
      return team
    }

    it('serves the requested locale', async () => {
      const { id } = await publishSample()
      const user = await insertUser()

      const problem = await getPublishedProblem(db, id, 'es', user.id)

      expect(problem).toMatchObject({
        id,
        points: 150,
        difficulty: 'medium',
        locale: 'es',
        title: 'Suma',
        statementMd: 'Suma dos números.',
      })
    })

    it('returns only the visible cases, with no trace of the hidden one', async () => {
      const { id } = await publishSample()
      const user = await insertUser()

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.examples).toEqual([{ input: [1, 2], expected: 3 }])
      expect(JSON.stringify(problem)).not.toContain(secretExpected)
      expect(JSON.stringify(problem)).not.toContain('hidden')
    })

    it('falls back to pt and reports the locale actually served', async () => {
      const { id } = await publishSample()
      const user = await insertUser()
      await db
        .delete(problemTranslationsTable)
        .where(
          and(
            eq(problemTranslationsTable.problemId, id),
            eq(problemTranslationsTable.locale, 'es'),
          ),
        )

      const problem = await getPublishedProblem(db, id, 'es', user.id)

      expect(problem?.locale).toBe('pt')
      expect(problem?.title).toBe('Soma')
    })

    it('returns null when not even the pt translation exists', async () => {
      const { id } = await publishSample()
      const user = await insertUser()
      await db.delete(problemTranslationsTable).where(eq(problemTranslationsTable.problemId, id))

      expect(await getPublishedProblem(db, id, 'pt', user.id)).toBeNull()
    })

    it('returns null for a draft problem', async () => {
      const problem = await createProblem(db, { difficulty: 'easy' })
      await updateProblem(db, problem.id, {
        translations: [{ locale: 'pt', title: 'Soma', statementMd: 'a' }],
      })
      const user = await insertUser()

      expect(await getPublishedProblem(db, problem.id, 'pt', user.id)).toBeNull()
    })

    it('returns null for an archived problem', async () => {
      const { id } = await publishSample()
      const user = await insertUser()
      await archiveProblem(db, id)

      expect(await getPublishedProblem(db, id, 'pt', user.id)).toBeNull()
    })

    it('returns null for an unknown id', async () => {
      const unknown = '00000000-0000-0000-0000-000000000000'
      const user = await insertUser()
      expect(await getPublishedProblem(db, unknown, 'pt', user.id)).toBeNull()
    })

    it('returns null for a published problem never added to a round', async () => {
      const id = await createSampleProblem()
      const user = await insertUser()

      expect(await getPublishedProblem(db, id, 'pt', user.id)).toBeNull()
    })

    it('returns null while the problem only sits in a draft round', async () => {
      const id = await createSampleProblem()
      const user = await insertUser()
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [id],
      })
      if (!created.ok) throw new Error('expected create to succeed')

      expect(await getPublishedProblem(db, id, 'pt', user.id)).toBeNull()
    })

    it('reports the open round with no bestSubmission query', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('open')
      expect(problem?.roundId).toBe(roundId)
      expect(problem?.bestSubmission).toBeNull()
    })

    it('reports a closed round with the team best submission', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()
      const team = await insertTeamMember(user.id)
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected close to succeed')
      const achievedAt = new Date('2026-08-31T12:00:00.000Z')
      await db.insert(submissionsTable).values({
        problemId: id,
        roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 1,
        createdAt: achievedAt,
      })

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('closed')
      expect(problem?.roundId).toBeNull()
      expect(problem?.bestSubmission).toEqual({ score: 80, achievedAt, attempts: 1 })
    })

    it('reports bestSubmission null on a closed round when the team never submitted', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()
      await insertTeamMember(user.id)
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected close to succeed')

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('closed')
      expect(problem?.bestSubmission).toBeNull()
    })

    it('reports bestSubmission null on a closed round when the user has no team', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected close to succeed')

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('closed')
      expect(problem?.bestSubmission).toBeNull()
    })
  })
})
