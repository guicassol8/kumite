import { DEFAULT_LOCALE } from '@kumite/blocks'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'

import { SUBMISSION_COOLDOWN_MS } from '../../config'
import type { Db } from '../../db/client'
import { problemsTable, submissionsTable, teamMembersTable, teamsTable } from '../../db/schema'

import { getEventConfig } from '../event-config/event-config.service'
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
      achievedAt: submissionsTable.acceptedAt,
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
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.acceptedAt))
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
  judgingByRound.clear()
  acceptedTimestamps.length = 0
}

// --- Live load, for the organizer's live card (#279) ---
//
// Process-local, same reasoning as the throttle above. One timestamp per
// submission past the accept gate, kept for the sparkline's 15 minutes and
// pruned on every write and read. The throttle bounds the volume (one in
// flight per team plus the cooldown), so this stays a few thousand numbers.
const LIVE_WINDOW_MINUTES = 15
const MINUTE_MS = 60_000
const acceptedTimestamps: number[] = []

export type SubmissionLoad = {
  inFlight: number
  lastMinute: number
  perMinute: number[]
}

function pruneAcceptedTimestamps(now: number): void {
  const cutoff = now - LIVE_WINDOW_MINUTES * MINUTE_MS
  let expired = 0
  while (expired < acceptedTimestamps.length && (acceptedTimestamps[expired] ?? 0) <= cutoff) {
    expired++
  }
  acceptedTimestamps.splice(0, expired)
}

/** Records one submission past the accept gate. `now` is injectable for tests. */
export function recordAcceptedSubmission(now = Date.now()): void {
  acceptedTimestamps.push(now)
  pruneAcceptedTimestamps(now)
}

/**
 * What the organizer's live card shows about submissions: the throttle slots
 * held right now, and acceptances per minute over the last 15, oldest first.
 * Bucket `i` covers `(now - (15 - i) min, now - (14 - i) min]`, so the last one
 * is exactly the last minute and `lastMinute === perMinute[14]`.
 */
export function getSubmissionLoad(now = Date.now()): SubmissionLoad {
  pruneAcceptedTimestamps(now)
  const perMinute: number[] = Array(LIVE_WINDOW_MINUTES).fill(0)
  for (const timestamp of acceptedTimestamps) {
    const age = now - timestamp
    if (age < 0) continue
    const bucket = LIVE_WINDOW_MINUTES - 1 - Math.floor(age / MINUTE_MS)
    if (bucket < 0) continue
    perMinute[bucket] = (perMinute[bucket] ?? 0) + 1
  }
  return {
    inFlight: inFlightIdentities.size,
    lastMinute: perMinute[LIVE_WINDOW_MINUTES - 1] ?? 0,
    perMinute,
  }
}

// --- Judging in flight, per round (#176) ---
//
// Process-local, same reasoning as the throttle above. The round's closure
// must not be announced while a submission accepted inside it is still being
// judged: the front fetches a closed round's ranking exactly once, on that
// event, so announcing early shows a leaderboard missing the very submissions
// that came in at the buzzer.
const judgingByRound = new Map<string, number>()

function enterJudging(roundId: string): void {
  judgingByRound.set(roundId, (judgingByRound.get(roundId) ?? 0) + 1)
}

function leaveJudging(roundId: string): void {
  const current = judgingByRound.get(roundId)
  if (current === undefined) return
  if (current <= 1) judgingByRound.delete(roundId)
  else judgingByRound.set(roundId, current - 1)
}

/** Whether any submission accepted into this round is still being judged. */
export function hasJudgingInFlight(roundId: string): boolean {
  return (judgingByRound.get(roundId) ?? 0) > 0
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
  const hiddenCount = countHiddenCases(testCases)
  let passedCount = 0
  for (const [index, testCase] of testCases.entries()) {
    if (!testCase.hidden) continue
    if (results[index]?.outcome === 'passed') passedCount++
  }

  return hiddenCount === 0 ? 0 : Math.round((points * passedCount) / hiddenCount)
}

/**
 * The denominator every score is prorated over.
 *
 * Extracted so the number stamped into `submissions.hidden_case_count` and the
 * number `scoreSubmission` divides by are the same expression, not two readings
 * that could drift apart (#193).
 */
export function countHiddenCases(testCases: TestCase[]): number {
  return testCases.filter((testCase) => testCase.hidden).length
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
  | { ok: false; error: 'practice_not_submittable' }
  | {
      ok: false
      error: 'codegen_rejected'
      code: CodegenErrorCode
      message: string
      blockType?: string
    }
  | { ok: false; error: 'throttled'; reason: 'in_flight' | 'cooldown'; retryAfterMs: number }
  | { ok: false; error: 'submissions_paused' }
  | { ok: false; error: 'not_in_team' }

// Thrown inside the insert transaction to roll back the row and the stamp
// together when the author is no longer in the team (#353), and caught right
// outside it.
const authorLeftTheTeam = new Error('the author left the team while the submission was judged')

export async function findTeamIdForUser(db: Db, userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ teamId: teamMembersTable.teamId })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))

  return membership?.teamId ?? null
}

// Attempts belong to the team — the same grouping the leaderboard and
// getBestSubmission use. Two counts in one round trip (#280): `total` spans
// every round and numbers the persisted row (the unique index on (team,
// problem, attempt) needs it global), while `inRound` is the round's own count,
// the one its ranking and the problem page show for a reused problem.
async function countAttempts(
  db: Db,
  identity: SubmitIdentity,
  problemId: string,
  roundId: string,
): Promise<{ total: number; inRound: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      inRound:
        sql<number>`count(*) filter (where ${submissionsTable.roundId} = ${roundId})`.mapWith(
          Number,
        ),
    })
    .from(submissionsTable)
    .where(
      and(eq(submissionsTable.problemId, problemId), eq(submissionsTable.teamId, identity.teamId)),
    )

  return { total: row?.total ?? 0, inRound: row?.inRound ?? 0 }
}

/**
 * The whole judging pipeline: throttle → pause → problem → practice refusal →
 * round → codegen → sandbox → score → persist → verdict.
 *
 * The organizer's pause (#285) is the first check inside the claimed slot.
 * The claim itself stays synchronous and first, so two concurrent requests
 * from one team keep a deterministic winner; a paused refusal releases the
 * slot and, like a 404, arms no cooldown — the first attempt after a resume
 * goes straight through.
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
  // Set only once the accept gate below has passed, so the `finally` releases
  // exactly what it claimed (#176).
  let judgingRoundId: string | null = null
  try {
    const { submissionsPaused } = await getEventConfig(db)
    if (submissionsPaused) return { ok: false, error: 'submissions_paused' }

    // Straight at the table, not problems.service.getProblem: the translation
    // join is irrelevant here and `status = 'published'` is part of the rule —
    // an unpublished problem is a 404, never a hint that a draft exists.
    const [problem] = await db
      .select()
      .from(problemsTable)
      .where(and(eq(problemsTable.id, body.problemId), eq(problemsTable.status, 'published')))
    if (!problem) return { ok: false, error: 'problem_not_found' }

    // Practice (#209) has no Submeter: refused before the round lookup, so the
    // answer is this validation error rather than a misleading no_active_round.
    // Nothing runs, so — like a 404 — no cooldown is armed.
    if (problem.visibility === 'practice') return { ok: false, error: 'practice_not_submittable' }

    // The client's timer is never the authority (#37): re-checked here,
    // against the round actually open right now, on every submission.
    if (!(await isProblemInOpenRound(db, body.roundId, problem.id))) {
      return { ok: false, error: 'no_active_round' }
    }

    // Accepted: from here to the INSERT, this round has judging in flight and
    // must not have its closure announced (#176).
    judgingRoundId = body.roundId
    enterJudging(judgingRoundId)
    // Same line as acceptedAt below: what the organizer's live card counts as
    // an accepted submission (#279).
    recordAcceptedSubmission()
    // Stamped now, not at INSERT time, so the tiebreak below never inflates a
    // team's time by however long the judge sandbox happened to take (#238).
    const acceptedAt = new Date()

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
    // unique index on (team, problem, attempt) is the backstop for the global
    // number. The round's number is never persisted, so it needs none. Counted
    // against the round the accept gate validated, like the INSERT below.
    const attempts = await countAttempts(db, identity, problem.id, body.roundId)
    const attemptNumber = attempts.total + 1
    const attemptInRound = attempts.inRound + 1

    let submission: typeof submissionsTable.$inferSelect
    try {
      submission = await db.transaction(async (tx) => {
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
            // The scale `score` was computed on, stamped from the same `problem`
            // row `scoreSubmission` just used (#193). Re-reading the problem here
            // would reopen the very window this issue is about.
            maxScore: problem.points,
            hiddenCaseCount: countHiddenCases(problem.testCases),
            attemptNumber,
            acceptedAt,
          })
          .returning()
        if (!row) throw new Error('expected the submission insert to return a row')

        // Conditional in SQL, so the "first" stamp can never be overwritten by a
        // later attempt racing the read.
        //
        // This UPDATE holds the team row in FOR NO KEY UPDATE until commit, and
        // that row lock is what leaveTeam waits on via FOR SHARE (#303), so a
        // leave can never slip out of a team this stamp is freezing. It must stay
        // ahead of the membership check below (#353). Taking the
        // `team-join:` advisory key here instead is deliberately avoided: it would
        // queue every submission behind the team's joins and moves, and widen the
        // keys held per transaction (#276's deadlock warning).
        await tx
          .update(teamsTable)
          .set({ firstSubmittedAt: sql`now()` })
          .where(and(eq(teamsTable.id, identity.teamId), isNull(teamsTable.firstSubmittedAt)))

        // #353: the identity was resolved before the judge, and the author may
        // have left (or been moved or removed by the organizer) while it ran.
        // The submission only counts for the team its author is still in now —
        // otherwise the row and the stamp roll back together (rule A).
        //
        // The order is the point. This is the only statement here that touches
        // team_members, and it runs AFTER the stamp: teams, then member — the
        // order leaveTeam and removeTeam lock in too, so no cycle can form. With
        // the member locked first, a leave holding the team row in FOR SHARE
        // would wait on this member lock while the stamp waited on its FOR SHARE:
        // 40P01 (the #352 review). When the team is already frozen the stamp
        // matches no row and locks nothing, leaving only this lock.
        //
        // FOR SHARE, not FOR KEY SHARE: team_members' key is user_id alone, so
        // moveMember's UPDATE of team_id only takes FOR NO KEY UPDATE, which
        // KEY SHARE would let through. FOR SHARE conflicts with it and with a
        // DELETE, so a move or leave in flight is waited on, and the re-check
        // under READ COMMITTED then sees whether the row still names this team.
        const [membership] = await tx
          .select({ userId: teamMembersTable.userId })
          .from(teamMembersTable)
          .where(
            and(
              eq(teamMembersTable.userId, identity.userId),
              eq(teamMembersTable.teamId, identity.teamId),
            ),
          )
          .for('share')
        if (!membership) throw authorLeftTheTeam

        return row
      })
    } catch (error) {
      // The sandbox did run, so the `finally` still arms the cooldown — on this
      // team's key, never on the one the author moved to.
      if (error === authorLeftTheTeam) return { ok: false, error: 'not_in_team' }
      throw error
    }

    return {
      ok: true,
      result: {
        submissionId: submission.id,
        attemptNumber,
        attemptInRound,
        score,
        // The value just stamped on the row, so what the participant is told
        // and what the ranking will read can never disagree (#193).
        maxScore: submission.maxScore ?? problem.points,
        cases: toResponseCases(problem.testCases, results),
      },
    }
  } finally {
    if (judgingRoundId !== null) leaveJudging(judgingRoundId)
    releaseSubmissionSlot(identityKey, ranTheJudge)
  }
}
