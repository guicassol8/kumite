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
import { closeRound, createRound, openRound, updateRound } from '../rounds/rounds.service'
import type { ProblemDetail, TestCase } from './problems.schema'
import {
  CreateProblemBodySchema,
  ParticipantProblemParamsSchema,
  ParticipantProblemQuerySchema,
  ParticipantProblemSchema,
  PracticeProblemListQuerySchema,
  PracticeProblemSummarySchema,
  TestCaseSchema,
  UpdateProblemBodySchema,
} from './problems.schema'
import type { UpdateProblemResult } from './problems.service'
import {
  archiveProblem,
  computeMissingLocales,
  createProblem,
  evaluateTestCaseCoverage,
  getProblem,
  getPublishedProblem,
  listPracticeProblems,
  listProblems,
  publishProblem,
  testCasesEqual,
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

describe('testCasesEqual', () => {
  const visible: TestCase = { input: 1, expected: 1, hidden: false }
  const hidden: TestCase = { input: 2, expected: 2, hidden: true }

  it('treats an identical list as equal', () => {
    expect(testCasesEqual([visible, hidden], [visible, hidden])).toBe(true)
  })

  it('ignores the key order inside each case — jsonb does not preserve it', () => {
    expect(testCasesEqual([visible], [{ hidden: false, expected: 1, input: 1 } as TestCase])).toBe(
      true,
    )
  })

  it('ignores key order deep inside a structured input', () => {
    const a: TestCase = { input: { x: 1, y: [{ p: 1, q: 2 }] }, expected: null, hidden: true }
    const b: TestCase = { input: { y: [{ q: 2, p: 1 }], x: 1 }, expected: null, hidden: true }
    expect(testCasesEqual([a], [b])).toBe(true)
  })

  it('reports a different length as different', () => {
    expect(testCasesEqual([visible], [visible, hidden])).toBe(false)
  })

  it('reports a reorder as different — caseResults indices are positional', () => {
    expect(testCasesEqual([visible, hidden], [hidden, visible])).toBe(false)
  })

  it('reports a flipped hidden flag as different', () => {
    expect(testCasesEqual([hidden], [{ ...hidden, hidden: false }])).toBe(false)
  })

  it('reports a changed expected value as different', () => {
    expect(testCasesEqual([hidden], [{ ...hidden, expected: 99 }])).toBe(false)
  })

  it('reports a changed input as different', () => {
    expect(testCasesEqual([hidden], [{ ...hidden, input: 99 }])).toBe(false)
  })

  it('treats two empty lists as equal', () => {
    expect(testCasesEqual([], [])).toBe(true)
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
      visibility: 'round',
      roundId: null,
      roundStatus: 'closed',
      bestSubmission: null,
      demoKey: null,
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
      visibility: 'round',
      roundId: '9f3f1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      roundStatus: 'open',
      bestSubmission: {
        score: 80,
        maxScore: 100,
        achievedAt: new Date().toISOString(),
        attempts: 2,
      },
      demoKey: null,
    })

    expect(parsed.roundStatus).toBe('open')
    expect(parsed.bestSubmission).toMatchObject({ score: 80, maxScore: 100, attempts: 2 })
  })

  // #319: the page never gets to guess the maximum — the back resolves the
  // legacy fallback, so a best submission without one is a broken response.
  it('rejects a bestSubmission without its maxScore (#319)', () => {
    const withBest = (bestSubmission: Record<string, unknown>) => ({
      id: '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      points: 100,
      difficulty: 'easy',
      locale: 'pt',
      title: 'Soma',
      statementMd: 'Some dois números.',
      examples: [],
      visibility: 'round',
      roundId: '9f3f1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      roundStatus: 'open',
      bestSubmission,
      demoKey: null,
    })
    const achievedAt = new Date().toISOString()

    expect(
      ParticipantProblemSchema.safeParse(withBest({ score: 80, achievedAt, attempts: 2 })).success,
    ).toBe(false)
    expect(
      ParticipantProblemSchema.safeParse(
        withBest({ score: 80, maxScore: null, achievedAt, attempts: 2 }),
      ).success,
    ).toBe(false)
  })

  it('accepts a practice problem with no round at all (#209)', () => {
    const parsed = ParticipantProblemSchema.parse({
      id: '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      points: 100,
      difficulty: 'easy',
      locale: 'pt',
      title: 'Soma',
      statementMd: 'Some dois números.',
      examples: [],
      visibility: 'practice',
      roundId: null,
      roundStatus: 'none',
      bestSubmission: null,
      demoKey: null,
    })

    expect(parsed.visibility).toBe('practice')
    expect(parsed.roundStatus).toBe('none')
  })

  // #212: the link from a seeded practice problem to its step-by-step demo.
  // Nullable, not optional — every read says whether there is a demo.
  const practiceRead = {
    id: '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
    points: 100,
    difficulty: 'easy',
    locale: 'pt',
    title: 'É par?',
    statementMd: 'Descubra se é par.',
    examples: [],
    visibility: 'practice',
    roundId: null,
    roundStatus: 'none',
    bestSubmission: null,
  }

  it('accepts a known demoKey (#212)', () => {
    expect(ParticipantProblemSchema.parse({ ...practiceRead, demoKey: 'e-par' }).demoKey).toBe(
      'e-par',
    )
  })

  it('rejects a demoKey outside the catalog and a missing one (#212)', () => {
    expect(ParticipantProblemSchema.safeParse({ ...practiceRead, demoKey: 'nope' }).success).toBe(
      false,
    )
    expect(ParticipantProblemSchema.safeParse(practiceRead).success).toBe(false)
  })
})

describe('problem visibility DTOs (#209)', () => {
  it('lets CreateProblemBody omit visibility and accepts both values', () => {
    expect(CreateProblemBodySchema.parse({ difficulty: 'easy' }).visibility).toBeUndefined()
    expect(
      CreateProblemBodySchema.parse({ difficulty: 'easy', visibility: 'practice' }).visibility,
    ).toBe('practice')
  })

  it('rejects an unknown visibility on create and update', () => {
    expect(
      CreateProblemBodySchema.safeParse({ difficulty: 'easy', visibility: 'secret' }).success,
    ).toBe(false)
    expect(UpdateProblemBodySchema.safeParse({ visibility: 'secret' }).success).toBe(false)
  })

  it('accepts visibility on update', () => {
    expect(UpdateProblemBodySchema.parse({ visibility: 'round' }).visibility).toBe('round')
  })

  it('defaults the practice list locale to pt', () => {
    expect(PracticeProblemListQuerySchema.parse({})).toEqual({ locale: 'pt' })
    expect(PracticeProblemListQuerySchema.safeParse({ locale: 'fr' }).success).toBe(false)
  })

  it('keeps a practice list item to id, title, difficulty and locale', () => {
    const parsed = PracticeProblemSummarySchema.parse({
      id: '3f0c1b52-9a6e-4c1f-8c2f-0d2f5a9b7e11',
      title: 'Soma',
      difficulty: 'easy',
      locale: 'pt',
      testCases: [{ input: 1, expected: 1, hidden: true }],
    })

    expect(Object.keys(parsed).sort()).toEqual(['difficulty', 'id', 'locale', 'title'])
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

  // #209 (A1): practice has no Submeter, so nothing ever reads a hidden case.
  it('asks only for a visible case on a practice problem', () => {
    expect(evaluateTestCaseCoverage([{ input: 1, expected: 1, hidden: false }], 'practice')).toBe(
      'ok',
    )
    expect(evaluateTestCaseCoverage([{ input: 1, expected: 1, hidden: true }], 'practice')).toBe(
      'missing_visible',
    )
    expect(evaluateTestCaseCoverage([], 'practice')).toBe('missing_visible')
  })

  it('keeps asking for both on a round problem', () => {
    expect(evaluateTestCaseCoverage([{ input: 1, expected: 1, hidden: false }], 'round')).toBe(
      'missing_hidden',
    )
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

  // #209: every row that predates the column, and every insert that does not
  // name it, is a competition problem — nothing about the competition moves.
  it('defaults visibility to round when not provided', async () => {
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'draft' })
      .returning()

    expect(problem?.visibility).toBe('round')
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

  // updateProblem answers a union (#193), so every test that reads the updated
  // problem has to narrow it first. Throwing here keeps the assertion that
  // follows about the problem, not about the discriminant.
  const expectUpdated = (result: UpdateProblemResult): ProblemDetail => {
    if (!result.ok) throw new Error(`expected the update to succeed, got '${result.error}'`)
    return result.problem
  }

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

    const updated = expectUpdated(
      await updateProblem(db, problem.id, {
        translations: [{ locale: 'es', title: 'Suma', statementMd: 'Suma dos números.' }],
      }),
    )

    expect(updated.translations).toHaveLength(2)
    expect(updated.translations.find((t) => t.locale === 'pt')?.title).toBe('Soma')
    expect(updated.translations.find((t) => t.locale === 'es')?.title).toBe('Suma')
  })

  it('returns not_found from updateProblem for an unknown id', async () => {
    const result = await updateProblem(db, '00000000-0000-0000-0000-000000000000', {
      difficulty: 'hard',
    })
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('replaces testCases wholesale', async () => {
    const problem = await createProblem(db, { difficulty: 'easy' })
    await updateProblem(db, problem.id, { testCases: [visibleCase, hiddenCase] })

    const updated = expectUpdated(await updateProblem(db, problem.id, { testCases: [visibleCase] }))

    expect(updated.testCases).toEqual([visibleCase])
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

  // #193: editing the scoring inputs of a problem while its round is open
  // leaves the round's teams prorated over different denominators, which the
  // ranking then sums as if they were commensurable. The guard refuses the
  // edit; everything that does not feed `scoreSubmission` stays editable, so
  // the organizer can still fix a typo in the statement mid-round.
  describe('updateProblem guard for a problem in an open round', () => {
    const otherHiddenCase = { input: 3, expected: 3, hidden: true }

    const publishedProblemInOpenRound = async () => {
      const problem = await createProblem(db, { difficulty: 'easy' })
      await updateProblem(db, problem.id, {
        translations: [
          { locale: 'pt', title: 'Soma', statementMd: 'a' },
          { locale: 'es', title: 'Suma', statementMd: 'b' },
          { locale: 'en', title: 'Sum', statementMd: 'c' },
        ],
        testCases: [visibleCase, hiddenCase],
      })
      const published = await publishProblem(db, problem.id)
      if (!published.ok) throw new Error('expected the problem to publish')

      const created = await createRound(db, {
        name: 'Rodada 193',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected the round to be created')
      return { problemId: problem.id, roundId: created.round.id }
    }

    const open = async (roundId: string) => {
      const opened = await openRound(db, roundId)
      if (!opened.ok) throw new Error(`expected the round to open, got '${opened.error}'`)
    }

    it('refuses different testCases and writes nothing', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const result = await updateProblem(db, problemId, {
        testCases: [visibleCase, hiddenCase, otherHiddenCase],
      })

      expect(result).toEqual({
        ok: false,
        error: 'problem_in_open_round',
        fields: ['testCases'],
      })
      const untouched = await getProblem(db, problemId)
      expect(untouched?.testCases).toEqual([visibleCase, hiddenCase])
    })

    it('refuses a different points value', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const result = await updateProblem(db, problemId, { points: 250 })

      expect(result).toEqual({ ok: false, error: 'problem_in_open_round', fields: ['points'] })
      expect((await getProblem(db, problemId))?.points).toBe(100)
    })

    it('names both fields when both would change', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const result = await updateProblem(db, problemId, {
        points: 250,
        testCases: [visibleCase, otherHiddenCase],
      })

      expect(result).toEqual({
        ok: false,
        error: 'problem_in_open_round',
        fields: ['testCases', 'points'],
      })
    })

    it('refuses test cases that are only reordered — the indices of caseResults move', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const result = await updateProblem(db, problemId, {
        testCases: [hiddenCase, visibleCase],
      })

      expect(result).toEqual({
        ok: false,
        error: 'problem_in_open_round',
        fields: ['testCases'],
      })
    })

    it('refuses a case whose hidden flag flipped, even at the same length', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const result = await updateProblem(db, problemId, {
        testCases: [visibleCase, { ...hiddenCase, hidden: false }],
      })

      expect(result).toMatchObject({ ok: false, error: 'problem_in_open_round' })
    })

    it('allows a statement fix mid-round — the case the issue asks to keep working', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const updated = expectUpdated(
        await updateProblem(db, problemId, {
          difficulty: 'hard',
          translations: [{ locale: 'pt', title: 'Soma', statementMd: 'Some dois números.' }],
        }),
      )

      expect(updated.difficulty).toBe('hard')
      expect(updated.translations.find((t) => t.locale === 'pt')?.statementMd).toBe(
        'Some dois números.',
      )
    })

    it('allows the form resending the identical testCases and points it just loaded', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      // buildPatchBody (front/src/lib/problem-form.ts) always sends all four
      // fields, so a guard on presence rather than on value would reject every
      // save while a round is open.
      const updated = expectUpdated(
        await updateProblem(db, problemId, {
          difficulty: 'easy',
          points: 100,
          testCases: [visibleCase, hiddenCase],
          translations: [{ locale: 'pt', title: 'Soma', statementMd: 'a' }],
        }),
      )

      expect(updated.testCases).toEqual([visibleCase, hiddenCase])
    })

    it('allows the same testCases sent with the object keys in another order', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)

      const updated = expectUpdated(
        await updateProblem(db, problemId, {
          testCases: [
            { hidden: false, expected: 1, input: 1 },
            { expected: 2, hidden: true, input: 2 },
          ],
        }),
      )

      expect(updated.testCases).toHaveLength(2)
    })

    it('allows the edit once the round is closed', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected the round to close')

      const updated = expectUpdated(
        await updateProblem(db, problemId, { points: 250, testCases: [visibleCase] }),
      )

      expect(updated.points).toBe(250)
      expect(updated.testCases).toEqual([visibleCase])
    })

    it('allows the edit while the round is still a draft', async () => {
      const { problemId } = await publishedProblemInOpenRound()

      const updated = expectUpdated(
        await updateProblem(db, problemId, { testCases: [visibleCase, otherHiddenCase] }),
      )

      expect(updated.testCases).toEqual([visibleCase, otherHiddenCase])
    })

    it('keeps the hidden-case denominator of an open round immutable', async () => {
      const { problemId, roundId } = await publishedProblemInOpenRound()
      await open(roundId)
      const denominator = (await getProblem(db, problemId))?.testCases.filter(
        (testCase) => testCase.hidden,
      ).length

      await updateProblem(db, problemId, { testCases: [visibleCase] })
      await updateProblem(db, problemId, {
        testCases: [visibleCase, hiddenCase, otherHiddenCase],
      })

      const after = (await getProblem(db, problemId))?.testCases.filter(
        (testCase) => testCase.hidden,
      ).length
      expect(after).toBe(denominator)
    })
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

    it('reports bestSubmission null on the open round when the user has no team', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('open')
      expect(problem?.roundId).toBe(roundId)
      expect(problem?.bestSubmission).toBeNull()
    })

    it('reports the team best submission while the round is open', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()
      const team = await insertTeamMember(user.id)
      const achievedAt = new Date('2026-08-31T12:00:00.000Z')
      await db.insert(submissionsTable).values({
        problemId: id,
        roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 60,
        maxScore: 150,
        attemptNumber: 1,
        acceptedAt: achievedAt,
      })

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('open')
      expect(problem?.roundId).toBe(roundId)
      expect(problem?.bestSubmission).toEqual({ score: 60, maxScore: 150, achievedAt, attempts: 1 })
    })

    it('reports bestSubmission null on the open round when the team never submitted', async () => {
      const { id } = await publishSample()
      const user = await insertUser()
      await insertTeamMember(user.id)

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('open')
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
        maxScore: 150,
        attemptNumber: 1,
        acceptedAt: achievedAt,
        // Deliberately different from acceptedAt: proves bestSubmission reads
        // acceptedAt, not the INSERT timestamp (#238).
        createdAt: new Date('2026-08-31T13:00:00.000Z'),
      })

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('closed')
      expect(problem?.roundId).toBeNull()
      expect(problem?.bestSubmission).toEqual({ score: 80, maxScore: 150, achievedAt, attempts: 1 })
    })

    // #319 AC1 + AC3: once the round closes the organizer may change points
    // again (#193), and the maximum beside a judged score must not follow.
    it('keeps the stamped maximum after the points change on a closed round (#319)', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()
      const team = await insertTeamMember(user.id)
      await db.insert(submissionsTable).values({
        problemId: id,
        roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 75,
        maxScore: 150,
        attemptNumber: 1,
        acceptedAt: new Date(),
      })
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected close to succeed')
      const updated = await updateProblem(db, id, { points: 250 })
      if (!updated.ok) throw new Error(`expected the update to succeed, got '${updated.error}'`)

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.roundStatus).toBe('closed')
      // What the problem is worth now...
      expect(problem?.points).toBe(250)
      // ...and what this score was computed against, unchanged.
      expect(problem?.bestSubmission).toMatchObject({ score: 75, maxScore: 150 })
    })

    // #319 AC2: a row judged before the stamp (#193) has maxScore NULL; the
    // current points are the only number left, which is what the page showed
    // before this fix.
    it('falls back to the current points for a submission without a stamp (#319)', async () => {
      const { id, roundId } = await publishSample()
      const user = await insertUser()
      const team = await insertTeamMember(user.id)
      await db.insert(submissionsTable).values({
        problemId: id,
        roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 75,
        maxScore: null,
        attemptNumber: 1,
        acceptedAt: new Date(),
      })
      const closed = await closeRound(db, roundId)
      if (!closed.ok) throw new Error('expected close to succeed')
      const updated = await updateProblem(db, id, { points: 250 })
      if (!updated.ok) throw new Error(`expected the update to succeed, got '${updated.error}'`)

      const problem = await getPublishedProblem(db, id, 'pt', user.id)

      expect(problem?.bestSubmission).toMatchObject({ score: 75, maxScore: 250 })
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

  // --- #209: practice visibility ---
  describe('practice visibility', () => {
    const translations = [
      { locale: 'pt' as const, title: 'Soma', statementMd: 'Some dois números.' },
      { locale: 'es' as const, title: 'Suma', statementMd: 'Suma dos números.' },
      { locale: 'en' as const, title: 'Sum', statementMd: 'Sum two numbers.' },
    ]
    const secretExpected = 'RESPOSTA-OCULTA-PRATICA'

    const publishedPractice = async (difficulty: 'easy' | 'medium' | 'hard' = 'easy') => {
      const problem = await createProblem(db, { difficulty, visibility: 'practice' })
      expectUpdated(
        await updateProblem(db, problem.id, {
          translations,
          testCases: [{ input: [1, 2], expected: 3, hidden: false }],
        }),
      )
      const published = await publishProblem(db, problem.id)
      if (!published.ok) throw new Error(`expected practice to publish, got '${published.error}'`)
      return problem.id
    }

    const publishedRound = async () => {
      const problem = await createProblem(db, { difficulty: 'easy' })
      expectUpdated(
        await updateProblem(db, problem.id, { translations, testCases: [visibleCase, hiddenCase] }),
      )
      const published = await publishProblem(db, problem.id)
      if (!published.ok) throw new Error('expected round problem to publish')
      return problem.id
    }

    const insertUser = async () => {
      const [user] = await db
        .insert(usersTable)
        .values({
          email: `practice-${crypto.randomUUID()}@edu.pucrs.br`,
          passwordHash: 'hash',
          role: 'participant',
          university: 'pucrs',
        })
        .returning()
      if (!user) throw new Error('expected a user fixture')
      return user
    }

    describe('organizer CRUD', () => {
      it('creates a round problem by default and a practice one when asked', async () => {
        const plain = await createProblem(db, { difficulty: 'easy' })
        const practice = await createProblem(db, { difficulty: 'easy', visibility: 'practice' })

        expect(plain.visibility).toBe('round')
        expect(practice.visibility).toBe('practice')
        expect((await getProblem(db, practice.id))?.visibility).toBe('practice')
      })

      it('lists the visibility of every problem', async () => {
        const practice = await createProblem(db, { difficulty: 'easy', visibility: 'practice' })
        const plain = await createProblem(db, { difficulty: 'easy' })

        const summaries = await listProblems(db)

        expect(summaries.find((p) => p.id === practice.id)?.visibility).toBe('practice')
        expect(summaries.find((p) => p.id === plain.id)?.visibility).toBe('round')
      })

      it('publishes a practice problem with only a visible case', async () => {
        const id = await publishedPractice()
        expect((await getProblem(db, id))?.status).toBe('published')
      })

      it('still refuses a round problem with only a visible case', async () => {
        const problem = await createProblem(db, { difficulty: 'easy' })
        await updateProblem(db, problem.id, { translations, testCases: [visibleCase] })

        expect(await publishProblem(db, problem.id)).toEqual({
          ok: false,
          error: 'missing_test_cases',
          reason: 'missing_hidden',
        })
      })

      it('refuses a practice problem with only a hidden case', async () => {
        const problem = await createProblem(db, { difficulty: 'easy', visibility: 'practice' })
        await updateProblem(db, problem.id, { translations, testCases: [hiddenCase] })

        expect(await publishProblem(db, problem.id)).toEqual({
          ok: false,
          error: 'missing_test_cases',
          reason: 'missing_visible',
        })
      })

      it('switches round to practice when the problem is in no round', async () => {
        const id = await publishedRound()

        const updated = expectUpdated(await updateProblem(db, id, { visibility: 'practice' }))

        expect(updated.visibility).toBe('practice')
      })

      it('refuses round to practice while the problem sits in a draft round', async () => {
        const id = await publishedRound()
        const created = await createRound(db, { name: 'R', durationMinutes: 30, problemIds: [id] })
        if (!created.ok) throw new Error('expected the round to be created')

        expect(await updateProblem(db, id, { visibility: 'practice' })).toEqual({
          ok: false,
          error: 'problem_in_round',
        })
        expect((await getProblem(db, id))?.visibility).toBe('round')
      })

      it('refuses round to practice while the problem sits in a closed round', async () => {
        const id = await publishedRound()
        const created = await createRound(db, { name: 'R', durationMinutes: 30, problemIds: [id] })
        if (!created.ok) throw new Error('expected the round to be created')
        const opened = await openRound(db, created.round.id)
        if (!opened.ok) throw new Error('expected the round to open')
        const closed = await closeRound(db, created.round.id)
        if (!closed.ok) throw new Error('expected the round to close')

        expect(await updateProblem(db, id, { visibility: 'practice' })).toEqual({
          ok: false,
          error: 'problem_in_round',
        })
      })

      it('writes nothing else when the visibility switch is refused', async () => {
        const id = await publishedRound()
        const created = await createRound(db, { name: 'R', durationMinutes: 30, problemIds: [id] })
        if (!created.ok) throw new Error('expected the round to be created')

        await updateProblem(db, id, { visibility: 'practice', difficulty: 'hard' })

        expect((await getProblem(db, id))?.difficulty).toBe('easy')
      })

      it('lets an unchanged visibility through on a problem in a round', async () => {
        const id = await publishedRound()
        const created = await createRound(db, { name: 'R', durationMinutes: 30, problemIds: [id] })
        if (!created.ok) throw new Error('expected the round to be created')

        const updated = expectUpdated(
          await updateProblem(db, id, { visibility: 'round', difficulty: 'hard' }),
        )

        expect(updated.difficulty).toBe('hard')
      })

      it('refuses practice to round on a published problem with no hidden case', async () => {
        const id = await publishedPractice()

        expect(await updateProblem(db, id, { visibility: 'round' })).toEqual({
          ok: false,
          error: 'missing_test_cases',
          reason: 'missing_hidden',
        })
        expect((await getProblem(db, id))?.visibility).toBe('practice')
      })

      it('judges practice to round against the test cases sent in the same patch', async () => {
        const id = await publishedPractice()

        const updated = expectUpdated(
          await updateProblem(db, id, {
            visibility: 'round',
            testCases: [visibleCase, hiddenCase],
          }),
        )

        expect(updated.visibility).toBe('round')
      })

      it('lets practice to round through on a draft with no hidden case', async () => {
        const problem = await createProblem(db, { difficulty: 'easy', visibility: 'practice' })

        const updated = expectUpdated(await updateProblem(db, problem.id, { visibility: 'round' }))

        expect(updated.visibility).toBe('round')
      })
    })

    describe('rounds', () => {
      it('refuses a practice problem in createRound, inserting nothing', async () => {
        const id = await publishedPractice()

        const result = await createRound(db, { name: 'R', durationMinutes: 30, problemIds: [id] })

        expect(result).toEqual({ ok: false, error: 'invalid_problem_ids' })
        expect(await db.select().from(roundProblemsTable)).toEqual([])
        expect(await db.select().from(roundsTable)).toEqual([])
      })

      it('refuses a practice problem in updateRound, keeping the old list', async () => {
        const practiceId = await publishedPractice()
        const roundProblemId = await publishedRound()
        const created = await createRound(db, {
          name: 'R',
          durationMinutes: 30,
          problemIds: [roundProblemId],
        })
        if (!created.ok) throw new Error('expected the round to be created')

        const result = await updateRound(db, created.round.id, {
          problemIds: [roundProblemId, practiceId],
        })

        expect(result).toEqual({ ok: false, error: 'invalid_problem_ids' })
        const rows = await db.select().from(roundProblemsTable)
        expect(rows.map((row) => row.problemId)).toEqual([roundProblemId])
      })
    })

    describe('participant read', () => {
      it('serves a published practice problem with no round in existence', async () => {
        const id = await publishedPractice()
        const user = await insertUser()

        const problem = await getPublishedProblem(db, id, 'pt', user.id)

        expect(problem).toEqual({
          id,
          points: 100,
          difficulty: 'easy',
          locale: 'pt',
          title: 'Soma',
          statementMd: 'Some dois números.',
          examples: [{ input: [1, 2], expected: 3 }],
          visibility: 'practice',
          roundId: null,
          roundStatus: 'none',
          bestSubmission: null,
          demoKey: null,
        })
      })

      it('serves it just the same to a participant with a team', async () => {
        const id = await publishedPractice()
        const user = await insertUser()
        const [team] = await db.insert(teamsTable).values({ name: 'Time P' }).returning()
        if (!team) throw new Error('expected a team fixture')
        await db.insert(teamMembersTable).values({ userId: user.id, teamId: team.id })

        const problem = await getPublishedProblem(db, id, 'pt', user.id)

        expect(problem?.roundStatus).toBe('none')
        expect(problem?.bestSubmission).toBeNull()
      })

      it('serves the requested locale', async () => {
        const id = await publishedPractice()
        const user = await insertUser()

        expect((await getPublishedProblem(db, id, 'es', user.id))?.title).toBe('Suma')
        expect((await getPublishedProblem(db, id, 'en', user.id))?.title).toBe('Sum')
      })

      it('never leaks a hidden case a practice problem happens to carry', async () => {
        const problem = await createProblem(db, { difficulty: 'easy', visibility: 'practice' })
        await updateProblem(db, problem.id, {
          translations,
          testCases: [
            { input: [1, 2], expected: 3, hidden: false },
            { input: [9, 9], expected: secretExpected, hidden: true },
          ],
        })
        const published = await publishProblem(db, problem.id)
        if (!published.ok) throw new Error('expected practice to publish')
        const user = await insertUser()

        const read = await getPublishedProblem(db, problem.id, 'pt', user.id)

        expect(read?.examples).toEqual([{ input: [1, 2], expected: 3 }])
        expect(JSON.stringify(read)).not.toContain(secretExpected)
      })

      it('treats a draft or archived practice problem as nonexistent', async () => {
        const draft = await createProblem(db, { difficulty: 'easy', visibility: 'practice' })
        await updateProblem(db, draft.id, { translations })
        const archived = await publishedPractice()
        await archiveProblem(db, archived)
        const user = await insertUser()

        expect(await getPublishedProblem(db, draft.id, 'pt', user.id)).toBeNull()
        expect(await getPublishedProblem(db, archived, 'pt', user.id)).toBeNull()
      })

      it('reports visibility round on a competition problem', async () => {
        const id = await publishedRound()
        const created = await createRound(db, { name: 'R', durationMinutes: 30, problemIds: [id] })
        if (!created.ok) throw new Error('expected the round to be created')
        const opened = await openRound(db, created.round.id)
        if (!opened.ok) throw new Error('expected the round to open')
        const user = await insertUser()

        expect((await getPublishedProblem(db, id, 'pt', user.id))?.visibility).toBe('round')
      })

      // #212: the demo link is the seed's identity — the pt title — and only
      // on the practice branch. The same title on a round problem, open or
      // closed, never offers a demo.
      describe('demoKey', () => {
        const seededTitle = [
          { locale: 'pt' as const, title: 'É par?', statementMd: 'Descubra se é par.' },
          { locale: 'es' as const, title: 'Otro título', statementMd: 'Descubre si es par.' },
          { locale: 'en' as const, title: 'Another title', statementMd: 'Find out.' },
        ]

        it('links a practice problem whose pt title is a seeded one, in any locale', async () => {
          const id = await publishedPractice()
          expectUpdated(await updateProblem(db, id, { translations: seededTitle }))
          const user = await insertUser()

          expect((await getPublishedProblem(db, id, 'pt', user.id))?.demoKey).toBe('e-par')
          expect((await getPublishedProblem(db, id, 'en', user.id))?.demoKey).toBe('e-par')
        })

        it('is null on a practice problem the organizer wrote', async () => {
          const id = await publishedPractice()
          const user = await insertUser()

          expect((await getPublishedProblem(db, id, 'pt', user.id))?.demoKey).toBeNull()
        })

        it('is null on a round problem, open or closed, even with a seeded pt title', async () => {
          const id = await publishedRound()
          expectUpdated(await updateProblem(db, id, { translations: seededTitle }))
          const created = await createRound(db, {
            name: 'R',
            durationMinutes: 30,
            problemIds: [id],
          })
          if (!created.ok) throw new Error('expected the round to be created')
          const opened = await openRound(db, created.round.id)
          if (!opened.ok) throw new Error('expected the round to open')
          const user = await insertUser()

          expect((await getPublishedProblem(db, id, 'pt', user.id))?.demoKey).toBeNull()

          const closed = await closeRound(db, created.round.id)
          if (!closed.ok) throw new Error('expected the round to close')
          expect((await getPublishedProblem(db, id, 'pt', user.id))?.demoKey).toBeNull()
        })
      })
    })

    describe('listPracticeProblems', () => {
      it('lists only published practice problems', async () => {
        const practice = await publishedPractice()
        await publishedRound()
        await createProblem(db, { difficulty: 'easy', visibility: 'practice' })
        const archived = await publishedPractice()
        await archiveProblem(db, archived)

        const list = await listPracticeProblems(db, 'pt')

        expect(list).toEqual([{ id: practice, title: 'Soma', difficulty: 'easy', locale: 'pt' }])
      })

      it('serves each title in the requested locale, falling back to pt', async () => {
        const id = await publishedPractice()
        await db
          .delete(problemTranslationsTable)
          .where(
            and(
              eq(problemTranslationsTable.problemId, id),
              eq(problemTranslationsTable.locale, 'en'),
            ),
          )

        expect((await listPracticeProblems(db, 'es'))[0]).toMatchObject({
          title: 'Suma',
          locale: 'es',
        })
        expect((await listPracticeProblems(db, 'en'))[0]).toMatchObject({
          title: 'Soma',
          locale: 'pt',
        })
      })

      it('orders by difficulty, then creation time', async () => {
        const hard = await publishedPractice('hard')
        const easyLater = await publishedPractice('easy')
        const easyEarlier = await publishedPractice('easy')
        const medium = await publishedPractice('medium')
        await db
          .update(problemsTable)
          .set({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
          .where(eq(problemsTable.id, easyEarlier))

        const list = await listPracticeProblems(db, 'pt')

        expect(list.map((p) => p.id)).toEqual([easyEarlier, easyLater, medium, hard])
      })

      it('answers an empty list when there is no practice problem', async () => {
        await publishedRound()
        expect(await listPracticeProblems(db, 'pt')).toEqual([])
      })
    })
  })
})
