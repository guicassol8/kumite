import { and, desc, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { problemsTable, problemTranslationsTable } from '../../db/schema'
import type { Locale } from '../../lib/locale'
import { LocaleSchema } from '../../lib/locale'

import type {
  CreateProblemBody,
  ParticipantProblem,
  ProblemDetail,
  ProblemSummary,
  TestCase,
  UpdateProblemBody,
} from './problems.schema'

export function computeMissingLocales(locales: Locale[]): Locale[] {
  const present = new Set(locales)
  return LocaleSchema.options.filter((locale) => !present.has(locale))
}

export type TestCaseCoverage = 'ok' | 'missing_visible' | 'missing_hidden' | 'missing_both'

export function evaluateTestCaseCoverage(testCases: TestCase[]): TestCaseCoverage {
  const hasVisible = testCases.some((testCase) => !testCase.hidden)
  const hasHidden = testCases.some((testCase) => testCase.hidden)
  if (hasVisible && hasHidden) return 'ok'
  if (!hasVisible && !hasHidden) return 'missing_both'
  return hasVisible ? 'missing_hidden' : 'missing_visible'
}

type ProblemRow = typeof problemsTable.$inferSelect
type TranslationRow = typeof problemTranslationsTable.$inferSelect

function toDetail(problem: ProblemRow, translations: TranslationRow[]): ProblemDetail {
  return {
    id: problem.id,
    points: problem.points,
    difficulty: problem.difficulty,
    status: problem.status,
    testCases: problem.testCases,
    translations: translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      statementMd: t.statementMd,
    })),
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  }
}

export async function createProblem(db: Db, input: CreateProblemBody): Promise<ProblemDetail> {
  const [problem] = await db
    .insert(problemsTable)
    .values({
      difficulty: input.difficulty,
      status: 'draft',
      ...(input.points !== undefined ? { points: input.points } : {}),
    })
    .returning()
  if (!problem) throw new Error('expected problem to be inserted')

  return toDetail(problem, [])
}

export async function getProblem(db: Db, id: string): Promise<ProblemDetail | null> {
  const [problem] = await db.select().from(problemsTable).where(eq(problemsTable.id, id))
  if (!problem) return null

  const translations = await db
    .select()
    .from(problemTranslationsTable)
    .where(eq(problemTranslationsTable.problemId, id))
  return toDetail(problem, translations)
}

// The participant read (#11). Only published problems are visible: a draft, an
// archived one and an unknown id are all the same `null` — the route turns it
// into a single 404 so nothing about an unpublished problem can be inferred.
export async function getPublishedProblem(
  db: Db,
  id: string,
  locale: Locale,
): Promise<ParticipantProblem | null> {
  const [problem] = await db
    .select()
    .from(problemsTable)
    .where(and(eq(problemsTable.id, id), eq(problemsTable.status, 'published')))
  if (!problem) return null

  const translations = await db
    .select()
    .from(problemTranslationsTable)
    .where(eq(problemTranslationsTable.problemId, id))

  // pt is the fallback when the requested locale has no translation yet; the
  // response reports the locale actually served, not the one asked for.
  const translation =
    translations.find((t) => t.locale === locale) ?? translations.find((t) => t.locale === 'pt')
  if (!translation) return null

  return {
    id: problem.id,
    points: problem.points,
    difficulty: problem.difficulty,
    locale: translation.locale,
    title: translation.title,
    statementMd: translation.statementMd,
    // Filter, then map field by field — never spread a test case, or a new
    // column on it would leak into the participant payload by default.
    examples: problem.testCases
      .filter((testCase) => !testCase.hidden)
      .map((testCase) => ({ input: testCase.input, expected: testCase.expected })),
  }
}

export async function listProblems(db: Db): Promise<ProblemSummary[]> {
  const [problems, translations] = await Promise.all([
    db.select().from(problemsTable).orderBy(desc(problemsTable.createdAt)),
    db.select().from(problemTranslationsTable),
  ])

  const translationsByProblem = new Map<string, TranslationRow[]>()
  for (const translation of translations) {
    const list = translationsByProblem.get(translation.problemId) ?? []
    list.push(translation)
    translationsByProblem.set(translation.problemId, list)
  }

  return problems.map((problem) => ({
    id: problem.id,
    points: problem.points,
    difficulty: problem.difficulty,
    status: problem.status,
    testCaseCount: problem.testCases.length,
    translations: (translationsByProblem.get(problem.id) ?? []).map((t) => ({
      locale: t.locale,
      title: t.title,
    })),
  }))
}

export async function updateProblem(
  db: Db,
  id: string,
  input: UpdateProblemBody,
): Promise<ProblemDetail | null> {
  const [existing] = await db.select().from(problemsTable).where(eq(problemsTable.id, id))
  if (!existing) return null

  const patch: Partial<typeof problemsTable.$inferInsert> = {}
  if (input.difficulty !== undefined) patch.difficulty = input.difficulty
  if (input.points !== undefined) patch.points = input.points
  if (input.testCases !== undefined) patch.testCases = input.testCases
  if (Object.keys(patch).length > 0) {
    await db
      .update(problemsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(problemsTable.id, id))
  }

  if (input.translations && input.translations.length > 0) {
    await db
      .insert(problemTranslationsTable)
      .values(
        input.translations.map((translation) => ({
          problemId: id,
          locale: translation.locale,
          title: translation.title,
          statementMd: translation.statementMd,
        })),
      )
      .onConflictDoUpdate({
        target: [problemTranslationsTable.problemId, problemTranslationsTable.locale],
        set: {
          title: sql`excluded.title`,
          statementMd: sql`excluded.statement_md`,
          updatedAt: new Date(),
        },
      })
  }

  return getProblem(db, id)
}

export type PublishResult =
  | { ok: true; problem: ProblemDetail }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'archived_problem' }
  | { ok: false; error: 'incomplete_translations'; missingLocales: Locale[] }
  | { ok: false; error: 'missing_test_cases'; reason: Exclude<TestCaseCoverage, 'ok'> }

export async function publishProblem(db: Db, id: string): Promise<PublishResult> {
  const problem = await getProblem(db, id)
  if (!problem) return { ok: false, error: 'not_found' }
  if (problem.status === 'archived') return { ok: false, error: 'archived_problem' }

  const missingLocales = computeMissingLocales(problem.translations.map((t) => t.locale))
  if (missingLocales.length > 0) {
    return { ok: false, error: 'incomplete_translations', missingLocales }
  }

  const coverage = evaluateTestCaseCoverage(problem.testCases)
  if (coverage !== 'ok') return { ok: false, error: 'missing_test_cases', reason: coverage }

  if (problem.status !== 'published') {
    await db
      .update(problemsTable)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(problemsTable.id, id))
  }

  const published = await getProblem(db, id)
  if (!published) throw new Error('expected problem to still exist after publish')
  return { ok: true, problem: published }
}

export async function archiveProblem(db: Db, id: string): Promise<ProblemDetail | null> {
  const existing = await getProblem(db, id)
  if (!existing) return null

  if (existing.status !== 'archived') {
    await db
      .update(problemsTable)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(problemsTable.id, id))
  }

  return getProblem(db, id)
}
