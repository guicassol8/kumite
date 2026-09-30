import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { practiceDemoKeyFor } from '../../db/practice-problems'
import { problemsTable, problemTranslationsTable } from '../../db/schema'
import { canonicalJson } from '../../lib/json'
import type { Locale } from '../../lib/locale'
import { LocaleSchema } from '../../lib/locale'

import { getProblemRoundAccess, isProblemInAnyRound } from '../rounds/rounds.service'
import { findTeamIdForUser, getBestSubmission } from '../submissions/submissions.service'

import type {
  CreateProblemBody,
  ParticipantProblem,
  PracticeProblemSummary,
  ProblemDetail,
  ProblemSummary,
  ProblemVisibility,
  TestCase,
  UpdateProblemBody,
} from './problems.schema'

export function computeMissingLocales(locales: Locale[]): Locale[] {
  const present = new Set(locales)
  return LocaleSchema.options.filter((locale) => !present.has(locale))
}

export type TestCaseCoverage = 'ok' | 'missing_visible' | 'missing_hidden' | 'missing_both'

// A practice problem (#209) has no Submeter, so no hidden case is ever read:
// it only needs a visible one for Executar. Hidden cases stay allowed.
export function evaluateTestCaseCoverage(
  testCases: TestCase[],
  visibility: ProblemVisibility = 'round',
): TestCaseCoverage {
  const hasVisible = testCases.some((testCase) => !testCase.hidden)
  const hasHidden = testCases.some((testCase) => testCase.hidden)
  if (visibility === 'practice') return hasVisible ? 'ok' : 'missing_visible'
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
    visibility: problem.visibility,
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
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
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
  userId: string,
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

  const examples = problem.testCases
    .filter((testCase) => !testCase.hidden)
    .map((testCase) => ({ input: testCase.input, expected: testCase.expected }))

  // Practice (#209): readable by any participant, team or not, with no round
  // ever existing — and nothing round-shaped to report.
  if (problem.visibility === 'practice') {
    return {
      id: problem.id,
      points: problem.points,
      difficulty: problem.difficulty,
      locale: translation.locale,
      title: translation.title,
      statementMd: translation.statementMd,
      examples,
      visibility: 'practice',
      roundId: null,
      roundStatus: 'none',
      bestSubmission: null,
      // Matched on the pt title whatever locale is served (#212).
      demoKey: practiceDemoKeyFor(translations.find((t) => t.locale === 'pt')?.title),
    }
  }

  // Round access (#37): never in a round, or only in a draft one, is the same
  // 404 as an unpublished problem — neither announces itself.
  const access = await getProblemRoundAccess(db, id)
  if (access.status === 'none') return null

  const teamId = await findTeamIdForUser(db, userId)
  // The team's own best, open or closed (#206). Scored inside access.roundId,
  // not across every round that ever used this problem (#176) — that round's
  // leaderboard shows exactly the same number.
  const stored = teamId === null ? null : await getBestSubmission(db, teamId, id, access.roundId)
  // The maximum beside the score is the one it was computed against (#319):
  // the stamp on that row, which a later change to points never touches. A
  // NULL stamp means the row was judged before the stamp existed (#193); the
  // current points are then the only number there is — and exactly what the
  // page showed before this fix.
  const bestSubmission =
    stored === null ? null : { ...stored, maxScore: stored.maxScore ?? problem.points }

  if (access.status === 'open') {
    return {
      id: problem.id,
      points: problem.points,
      difficulty: problem.difficulty,
      locale: translation.locale,
      title: translation.title,
      statementMd: translation.statementMd,
      examples,
      visibility: 'round',
      roundId: access.roundId,
      roundStatus: 'open',
      bestSubmission,
      demoKey: null,
    }
  }

  return {
    id: problem.id,
    points: problem.points,
    difficulty: problem.difficulty,
    locale: translation.locale,
    title: translation.title,
    statementMd: translation.statementMd,
    examples,
    visibility: 'round',
    roundId: null,
    roundStatus: 'closed',
    bestSubmission,
    demoKey: null,
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
    visibility: problem.visibility,
    testCaseCount: problem.testCases.length,
    translations: (translationsByProblem.get(problem.id) ?? []).map((t) => ({
      locale: t.locale,
      title: t.title,
    })),
  }))
}

// The practice catalog (#209): published practice problems only, in a stable
// order — difficulty (enum order: easy → medium → hard), then creation, then
// id as the last tie-break. pt is the fallback title, as in the single read.
export async function listPracticeProblems(
  db: Db,
  locale: Locale,
): Promise<PracticeProblemSummary[]> {
  const problems = await db
    .select({ id: problemsTable.id, difficulty: problemsTable.difficulty })
    .from(problemsTable)
    .where(and(eq(problemsTable.status, 'published'), eq(problemsTable.visibility, 'practice')))
    .orderBy(asc(problemsTable.difficulty), asc(problemsTable.createdAt), asc(problemsTable.id))
  if (problems.length === 0) return []

  const translations = await db
    .select()
    .from(problemTranslationsTable)
    .where(
      inArray(
        problemTranslationsTable.problemId,
        problems.map((problem) => problem.id),
      ),
    )

  return problems.flatMap((problem) => {
    const own = translations.filter((t) => t.problemId === problem.id)
    const translation = own.find((t) => t.locale === locale) ?? own.find((t) => t.locale === 'pt')
    // Same rule as getPublishedProblem: no pt either means nothing to show.
    if (!translation) return []
    return [
      {
        id: problem.id,
        title: translation.title,
        difficulty: problem.difficulty,
        locale: translation.locale,
      },
    ]
  })
}

/**
 * Compares two test-case lists by value, the way Postgres compares the `jsonb`
 * column they live in: object key order is irrelevant, array order is not.
 *
 * A reorder counts as a change on purpose. `caseResults[].index`
 * (submissions.service.ts) is the position of the case at judging time, and
 * `toResponseCases` matches a stored result to a case positionally — moving a
 * case silently re-points every result already written.
 */
export function testCasesEqual(a: TestCase[], b: TestCase[]): boolean {
  if (a.length !== b.length) return false
  return a.every((testCase, index) => {
    const other = b[index]
    if (!other) return false
    return (
      testCase.hidden === other.hidden &&
      canonicalJson(testCase.input) === canonicalJson(other.input) &&
      canonicalJson(testCase.expected) === canonicalJson(other.expected)
    )
  })
}

/**
 * The fields of a problem that feed `scoreSubmission` — `points` is the literal
 * multiplier of the numerator and the hidden cases are the denominator. Changing
 * either one mid-round leaves the round's teams prorated over incommensurable
 * scales (#193). `difficulty` and `translations` touch neither, so they stay
 * editable while a round is open.
 */
export type ScoringField = 'testCases' | 'points'

export type UpdateProblemResult =
  | { ok: true; problem: ProblemDetail }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'problem_in_open_round'; fields: ScoringField[] }
  | { ok: false; error: 'problem_in_round' }
  | { ok: false; error: 'missing_test_cases'; reason: Exclude<TestCaseCoverage, 'ok'> }

export async function updateProblem(
  db: Db,
  id: string,
  input: UpdateProblemBody,
): Promise<UpdateProblemResult> {
  const [existing] = await db.select().from(problemsTable).where(eq(problemsTable.id, id))
  if (!existing) return { ok: false, error: 'not_found' }

  // Visibility switch (#209, A2). Allowed in any status, behind two locks —
  // both judged before anything is written.
  if (input.visibility !== undefined && input.visibility !== existing.visibility) {
    // round → practice: a problem that sat in any round keeps its history.
    if (input.visibility === 'practice' && (await isProblemInAnyRound(db, id))) {
      return { ok: false, error: 'problem_in_round' }
    }
    // practice → round on a published problem: the competition's publish
    // invariant (a hidden case to score against) has to hold already, judged
    // against the cases this same patch leaves behind.
    if (input.visibility === 'round' && existing.status === 'published') {
      const coverage = evaluateTestCaseCoverage(input.testCases ?? existing.testCases, 'round')
      if (coverage !== 'ok') return { ok: false, error: 'missing_test_cases', reason: coverage }
    }
  }

  // Compares values, never mere presence: the organizer's form rebuilds the
  // whole patch body on every save (front/src/lib/problem-form.ts), so a guard
  // on `input.testCases !== undefined` would refuse even a statement fix.
  const changedScoringFields: ScoringField[] = []
  if (input.testCases !== undefined && !testCasesEqual(input.testCases, existing.testCases)) {
    changedScoringFields.push('testCases')
  }
  if (input.points !== undefined && input.points !== existing.points) {
    changedScoringFields.push('points')
  }

  // Only pays for the round lookup when something that matters would move.
  if (changedScoringFields.length > 0) {
    const access = await getProblemRoundAccess(db, id)
    if (access.status === 'open') {
      return { ok: false, error: 'problem_in_open_round', fields: changedScoringFields }
    }
  }

  const patch: Partial<typeof problemsTable.$inferInsert> = {}
  if (input.difficulty !== undefined) patch.difficulty = input.difficulty
  if (input.points !== undefined) patch.points = input.points
  if (input.testCases !== undefined) patch.testCases = input.testCases
  if (input.visibility !== undefined) patch.visibility = input.visibility
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

  const problem = await getProblem(db, id)
  if (!problem) throw new Error('expected problem to still exist after update')
  return { ok: true, problem }
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

  const coverage = evaluateTestCaseCoverage(problem.testCases, problem.visibility)
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
