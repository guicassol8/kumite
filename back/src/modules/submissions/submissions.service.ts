import { DEFAULT_LOCALE } from '@kumite/blocks'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'

import { SUBMISSION_COOLDOWN_MS } from '../../config'
import type { Db } from '../../db/client'
import { problemsTable, submissionsTable, teamMembersTable, teamsTable } from '../../db/schema'

import type { CodegenErrorCode, JudgeCaseResult, JudgeOutcome } from '../judge/judge.schema'
import { generateJudgeSource, runJudge } from '../judge/judge.service'
import type { TestCase } from '../problems/problems.schema'
import { isProblemInOpenRound } from '../rounds/rounds.service'

import type {
  BestSubmission,
  SubmissionCaseResult,
  SubmissionCaseStatus,
  SubmissionResult,
  SubmissionResultCase,
  SubmitSolutionBody,
} from './submissions.schema'

// "Vale a melhor pontuação": the team's highest score on a problem, the moment
// it was reached (the tiebreaker) and how many attempts it took. Grouped by
// team, not user — the score belongs to the team (docs/product.md).
//
// Scoped to one round (#176), the same scope the leaderboard uses: a problem
// reused across rounds has one best score *per round*, and the problem page
// must show the round's own, or it contradicts that round's ranking.
export async function getBestSubmission(
  db: Db,
  teamId: string,
  problemId: string,
  roundId: string,
): Promise<BestSubmission | null> {
  const [best] = await db
    .select({
      score: submissionsTable.score,
      achievedAt: submissionsTable.createdAt,
      // Postgres evaluates window functions before LIMIT, so `count(*) over ()`
      // is the full attempt count for this (team, problem, round) — one round
      // trip for both the best row and the total.
      attempts: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(submissionsTable)
    .where(
      and(
        eq(submissionsTable.teamId, teamId),
        eq(submissionsTable.problemId, problemId),
        eq(submissionsTable.roundId, roundId),
      ),
    )
    // Ties go to the earliest submission: reaching the score first wins.
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.createdAt))
    .limit(1)

  return best ?? null
}

// --- Anti-abuse: one submission in flight per identity, plus a cooldown (#21) ---
//
// Process-local state, exactly like the judge's concurrency queue: a single
// API process is what this event runs, and the partial unique index on
// (team, problem, attempt) is the database-side backstop.
const inFlightIdentities = new Set<string>()
const cooldownUntil = new Map<string, number>()

export type ThrottleDenial = { reason: 'in_flight' | 'cooldown'; retryAfterMs: number }

/**
 * Claims the identity's single submission slot. Returns `null` when granted
 * (the slot is now held), or why it was refused and how long is left.
 *
 * `now` is injectable so the tests stay deterministic without fake timers.
 */
export function acquireSubmissionSlot(identity: string, now = Date.now()): ThrottleDenial | null {
  if (inFlightIdentities.has(identity)) return { reason: 'in_flight', retryAfterMs: 0 }

  const until = cooldownUntil.get(identity)
  if (until !== undefined && until > now) {
    return { reason: 'cooldown', retryAfterMs: until - now }
  }

  inFlightIdentities.add(identity)
  return null
}

/**
 * Releases the slot. The cooldown is armed only when the sandbox actually
 * ran — a 404 or a codegen refusal costs the participant nothing but the
 * round trip.
 */
export function releaseSubmissionSlot(
  identity: string,
  armCooldown: boolean,
  now = Date.now(),
): void {
  inFlightIdentities.delete(identity)
  if (armCooldown) cooldownUntil.set(identity, now + SUBMISSION_COOLDOWN_MS)
}

/** Test seam: clears both structures between cases. Never used in production. */
export function resetSubmissionThrottle(): void {
  inFlightIdentities.clear()
  cooldownUntil.clear()
}

// --- Scoring and case mapping (#21) ---

// Spelled out rather than derived, like the judge's CODEGEN_ERROR_CODES: a new
// judge outcome then breaks this table at typecheck instead of being written
// to a column whose enum has never heard of it.
const PERSISTED_CASE_STATUS: Record<JudgeOutcome, SubmissionCaseStatus> = {
  passed: 'passed',
  failed: 'failed',
  timeout: 'timeout',
  runtime_error: 'error',
}

/**
 * The problem's points, prorated over the hidden cases that passed.
 *
 * Only hidden cases score (epic #8): the visible ones exist so the participant
 * can see what their blocks did. Publishing requires at least one hidden case,
 * so the zero-hidden branch is unreachable through the route — the function
 * simply does not depend on that being true.
 */
export function scoreSubmission(
  testCases: TestCase[],
  results: JudgeCaseResult[],
  points: number,
): number {
  let hiddenCount = 0
  let passedCount = 0
  for (const [index, testCase] of testCases.entries()) {
    if (!testCase.hidden) continue
    hiddenCount++
    if (results[index]?.outcome === 'passed') passedCount++
  }

  return hiddenCount === 0 ? 0 : Math.round((points * passedCount) / hiddenCount)
}

/** What goes in `submissions.case_results`: the full picture, hidden included. */
export function toPersistedCaseResults(results: JudgeCaseResult[]): SubmissionCaseResult[] {
  return results.map((result, index) => ({ index, status: PERSISTED_CASE_STATUS[result.outcome] }))
}

/**
 * What the participant gets back. A visible case carries the expected value
 * plus whatever its outcome produced; a hidden one is reduced to its number
 * and a ✓/✗, so neither its input, its expected value nor a crash message can
 * be mined out of the response.
 */
export function toResponseCases(
  testCases: TestCase[],
  results: JudgeCaseResult[],
): SubmissionResultCase[] {
  return results.map((result, index) => {
    const testCase = testCases[index]
    // A result with no matching case would mean the judge ran something this
    // problem did not ask for — hide it rather than guess.
    if (!testCase || testCase.hidden) return { hidden: true, index, outcome: result.outcome }

    return {
      hidden: false,
      index,
      outcome: result.outcome,
      expected: testCase.expected,
      ...(result.outcome === 'failed' ? { actual: result.actual } : {}),
      ...(result.outcome === 'runtime_error' ? { detail: result.detail } : {}),
      ms: result.ms,
    }
  })
}

// --- The submission pipeline (#21) ---

/** Who is submitting: an authenticated user with a team, both mandatory. */
export type SubmitIdentity = { userId: string; teamId: string }

export type SubmitOutcome =
  | { ok: true; result: SubmissionResult }
  | { ok: false; error: 'problem_not_found' }
  | { ok: false; error: 'no_active_round' }
  | {
      ok: false
      error: 'codegen_rejected'
      code: CodegenErrorCode
      message: string
      blockType?: string
    }
  | { ok: false; error: 'throttled'; reason: 'in_flight' | 'cooldown'; retryAfterMs: number }

export async function findTeamIdForUser(db: Db, userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ teamId: teamMembersTable.teamId })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))

  return membership?.teamId ?? null
}

// Attempts belong to the team — the same grouping the leaderboard and
// getBestSubmission use.
async function countAttempts(db: Db, identity: SubmitIdentity, problemId: string): Promise<number> {
  const [row] = await db
    .select({ attempts: sql<number>`count(*)`.mapWith(Number) })
    .from(submissionsTable)
    .where(
      and(eq(submissionsTable.problemId, problemId), eq(submissionsTable.teamId, identity.teamId)),
    )

  return row?.attempts ?? 0
}

/**
 * The whole judging pipeline: throttle → problem → codegen → sandbox →
 * score → persist → verdict.
 *
 * The identity's slot is claimed before anything else and released in a
 * `finally`, so a crash can never leave a participant locked out. The 5s
 * cooldown is armed only once the sandbox has actually run: a 404 or a
 * codegen refusal is cheap and must not cost the participant a wait.
 */
export async function submitSolution(
  db: Db,
  identity: SubmitIdentity,
  body: SubmitSolutionBody,
): Promise<SubmitOutcome> {
  const identityKey = `team:${identity.teamId}`
  const denial = acquireSubmissionSlot(identityKey)
  if (denial) return { ok: false, error: 'throttled', ...denial }

  let ranTheJudge = false
  try {
    // Straight at the table, not problems.service.getProblem: the translation
    // join is irrelevant here and `status = 'published'` is part of the rule —
    // an unpublished problem is a 404, never a hint that a draft exists.
    const [problem] = await db
      .select()
      .from(problemsTable)
      .where(and(eq(problemsTable.id, body.problemId), eq(problemsTable.status, 'published')))
    if (!problem) return { ok: false, error: 'problem_not_found' }

    // The client's timer is never the authority (#37): re-checked here,
    // against the round actually open right now, on every submission.
    if (!(await isProblemInOpenRound(db, body.roundId, problem.id))) {
      return { ok: false, error: 'no_active_round' }
    }

    const generated = generateJudgeSource(body.workspace, body.locale ?? DEFAULT_LOCALE)
    if (!generated.ok) {
      // Nothing runs: a workspace codegen refuses never reaches the sandbox.
      return {
        ok: false,
        error: 'codegen_rejected',
        code: generated.error,
        message: generated.message,
        ...(generated.blockType === undefined ? {} : { blockType: generated.blockType }),
      }
    }

    ranTheJudge = true
    const results = await runJudge(
      generated.source,
      problem.testCases.map(({ input, expected }) => ({ input, expected })),
    )

    const score = scoreSubmission(problem.testCases, results, problem.points)
    // The in-flight lock is what serializes this read-then-insert; the partial
    // unique index on (team, problem, attempt) is the backstop.
    const attemptNumber = (await countAttempts(db, identity, problem.id)) + 1

    const submission = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(submissionsTable)
        .values({
          problemId: problem.id,
          // The round the accept gate above validated, not one re-derived from
          // the clock (#176): judging can outlive the round, and the row would
          // otherwise land outside the window it was accepted in.
          roundId: body.roundId,
          userId: identity.userId,
          teamId: identity.teamId,
          workspace: body.workspace,
          generatedCode: generated.source,
          caseResults: toPersistedCaseResults(results),
          score,
          attemptNumber,
        })
        .returning()
      if (!row) throw new Error('expected the submission insert to return a row')

      // Conditional in SQL, so the "first" stamp can never be overwritten by a
      // later attempt racing the read.
      await tx
        .update(teamsTable)
        .set({ firstSubmittedAt: sql`now()` })
        .where(and(eq(teamsTable.id, identity.teamId), isNull(teamsTable.firstSubmittedAt)))

      return row
    })

    return {
      ok: true,
      result: {
        submissionId: submission.id,
        attemptNumber,
        score,
        maxScore: problem.points,
        cases: toResponseCases(problem.testCases, results),
      },
    }
  } finally {
    releaseSubmissionSlot(identityKey, ranTheJudge)
  }
}
