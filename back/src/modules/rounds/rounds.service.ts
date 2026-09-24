import { and, asc, desc, eq, inArray, lte, ne } from 'drizzle-orm'
import postgres from 'postgres'

import type { Db } from '../../db/client'
import {
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
} from '../../db/schema'
import type { Locale } from '../../lib/locale'

import type {
  CreateRoundBody,
  ParticipantRoundDetail,
  RoundDetail,
  RoundSummary,
  UpdateRoundBody,
} from './rounds.schema'

type RoundRow = typeof roundsTable.$inferSelect
type RoundProblemRow = typeof roundProblemsTable.$inferSelect

export type ReapedRound = { id: string; closesAt: Date | null }

// --- Closed rounds still waiting to be announced (#176) ---
//
// reapExpiredRound is called from ~11 read paths but only the SSE tick
// publishes round.closed. Whichever read reaped the round first used to win
// the race and the tick, finding no freshly-closed row, announced nothing —
// the event was simply lost. Every close now lands here instead, and the
// announcer drains it, so the closure survives no matter which path noticed
// it. Process-local, same reasoning as the submission throttle.
const pendingClosures = new Map<string, Date>()

export type PendingClosure = { roundId: string; closedAt: Date }

export function pendingRoundClosures(): PendingClosure[] {
  return [...pendingClosures].map(([roundId, closedAt]) => ({ roundId, closedAt }))
}

export function clearPendingRoundClosure(roundId: string): void {
  pendingClosures.delete(roundId)
}

/** Test seam: forgets every unannounced closure. Never used in production. */
export function resetPendingRoundClosures(): void {
  pendingClosures.clear()
}

// Lazy expiry: a round past its own closesAt is closed here, on the read
// path, so nothing depends on a scheduler ever running. closedAt is set to
// the round's own closesAt (deterministic "closed exactly on schedule"), not
// to whenever this happened to run. Returns the round(s) this call actually
// closed (empty when nothing was expired) so callers — the SSE tick — know
// what to announce without a second query.
export async function reapExpiredRound(db: Db): Promise<ReapedRound[]> {
  const closed = await db
    .update(roundsTable)
    .set({ status: 'closed', closedAt: roundsTable.closesAt, updatedAt: new Date() })
    .where(and(eq(roundsTable.status, 'open'), lte(roundsTable.closesAt, new Date())))
    .returning({ id: roundsTable.id, closesAt: roundsTable.closesAt })

  const now = new Date()
  for (const round of closed) pendingClosures.set(round.id, now)
  return closed
}

function toDetail(round: RoundRow, problems: RoundProblemRow[]): RoundDetail {
  return {
    id: round.id,
    name: round.name,
    status: round.status,
    durationMinutes: round.durationMinutes,
    openedAt: round.openedAt,
    closesAt: round.closesAt,
    closedAt: round.closedAt,
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
    problems: problems
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ problemId: p.problemId, position: p.position })),
  }
}

function toSummary(round: RoundRow, problemCount: number): RoundSummary {
  return {
    id: round.id,
    name: round.name,
    status: round.status,
    durationMinutes: round.durationMinutes,
    openedAt: round.openedAt,
    closesAt: round.closesAt,
    closedAt: round.closedAt,
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
    problemCount,
  }
}

export async function getRound(db: Db, id: string): Promise<RoundDetail | null> {
  await reapExpiredRound(db)

  const [round] = await db.select().from(roundsTable).where(eq(roundsTable.id, id))
  if (!round) return null

  const problems = await db
    .select()
    .from(roundProblemsTable)
    .where(eq(roundProblemsTable.roundId, id))
  return toDetail(round, problems)
}

export async function listRounds(db: Db): Promise<RoundSummary[]> {
  await reapExpiredRound(db)

  const [rounds, problems] = await Promise.all([
    db.select().from(roundsTable),
    db.select().from(roundProblemsTable),
  ])

  const countByRound = new Map<string, number>()
  for (const problem of problems) {
    countByRound.set(problem.roundId, (countByRound.get(problem.roundId) ?? 0) + 1)
  }

  return rounds.map((round) => toSummary(round, countByRound.get(round.id) ?? 0))
}

// Participant-facing view of listRounds: a draft round is undisclosed by
// definition (the organizer hasn't opened it yet), so it's filtered out
// rather than reused as-is. Open-first, then closed rounds newest-first,
// matches the home screen's round card followed by a closed-rounds list.
export async function listParticipantRounds(db: Db): Promise<RoundSummary[]> {
  const rounds = await listRounds(db)
  return rounds
    .filter((round) => round.status !== 'draft')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0)
    })
}

// Any round currently open, used by openRound to enforce "only one at a time"
// with a friendly error before the DB's own partial unique index would.
export async function findOpenRound(db: Db): Promise<RoundRow | null> {
  const [round] = await db.select().from(roundsTable).where(eq(roundsTable.status, 'open'))
  return round ?? null
}

// A missing id and a not-published one are reported identically: a draft
// problem never announces itself to the round-building flow (same rule as
// the participant read in problems.service.ts). A practice problem (#209) is
// not eligible either — it never enters round_problems, which is what keeps
// it out of the ranking, the stats and the export by construction.
async function hasOnlyPublishedProblems(db: Db, problemIds: string[]): Promise<boolean> {
  if (problemIds.length === 0) return true
  const rows = await db
    .select({ id: problemsTable.id })
    .from(problemsTable)
    .where(
      and(
        inArray(problemsTable.id, problemIds),
        eq(problemsTable.status, 'published'),
        eq(problemsTable.visibility, 'round'),
      ),
    )
  return rows.length === problemIds.length
}

// Any round at all — draft, open or closed (#209). A problem that ever sat in
// a round carries history (submissions, ranking, export) that must not turn
// into practice underneath it.
export async function isProblemInAnyRound(db: Db, problemId: string): Promise<boolean> {
  const [row] = await db
    .select({ roundId: roundProblemsTable.roundId })
    .from(roundProblemsTable)
    .where(eq(roundProblemsTable.problemId, problemId))
    .limit(1)
  return row !== undefined
}

export type CreateRoundResult =
  | { ok: true; round: RoundDetail }
  | { ok: false; error: 'invalid_problem_ids' }

export async function createRound(db: Db, input: CreateRoundBody): Promise<CreateRoundResult> {
  if (!(await hasOnlyPublishedProblems(db, input.problemIds))) {
    return { ok: false, error: 'invalid_problem_ids' }
  }

  const created = await db.transaction(async (tx) => {
    const [round] = await tx
      .insert(roundsTable)
      .values({ name: input.name, durationMinutes: input.durationMinutes })
      .returning()
    if (!round) throw new Error('expected round to be inserted')

    if (input.problemIds.length > 0) {
      await tx.insert(roundProblemsTable).values(
        input.problemIds.map((problemId, position) => ({
          roundId: round.id,
          problemId,
          position,
        })),
      )
    }

    return round
  })

  const detail = await getRound(db, created.id)
  if (!detail) throw new Error('expected round to still exist right after create')
  return { ok: true, round: detail }
}

export type UpdateRoundResult =
  | { ok: true; round: RoundDetail }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'round_not_draft' }
  | { ok: false; error: 'invalid_problem_ids' }

export async function updateRound(
  db: Db,
  id: string,
  input: UpdateRoundBody,
): Promise<UpdateRoundResult> {
  await reapExpiredRound(db)

  const [existing] = await db.select().from(roundsTable).where(eq(roundsTable.id, id))
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'draft') return { ok: false, error: 'round_not_draft' }

  if (input.problemIds !== undefined && !(await hasOnlyPublishedProblems(db, input.problemIds))) {
    return { ok: false, error: 'invalid_problem_ids' }
  }

  await db.transaction(async (tx) => {
    const patch: Partial<typeof roundsTable.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes
    if (Object.keys(patch).length > 0) {
      await tx
        .update(roundsTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(roundsTable.id, id))
    }

    if (input.problemIds !== undefined) {
      await tx.delete(roundProblemsTable).where(eq(roundProblemsTable.roundId, id))
      if (input.problemIds.length > 0) {
        await tx.insert(roundProblemsTable).values(
          input.problemIds.map((problemId, position) => ({
            roundId: id,
            problemId,
            position,
          })),
        )
      }
    }
  })

  const detail = await getRound(db, id)
  if (!detail) throw new Error('expected round to still exist right after update')
  return { ok: true, round: detail }
}

export type OpenRoundResult =
  | { ok: true; round: RoundDetail }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'another_round_open' }
  | { ok: false; error: 'round_not_draft' }
  | { ok: false; error: 'no_problems' }

export async function openRound(db: Db, id: string): Promise<OpenRoundResult> {
  await reapExpiredRound(db)

  const [existing] = await db.select().from(roundsTable).where(eq(roundsTable.id, id))
  if (!existing) return { ok: false, error: 'not_found' }

  const openRoundRow = await findOpenRound(db)
  if (openRoundRow) return { ok: false, error: 'another_round_open' }
  if (existing.status !== 'draft') return { ok: false, error: 'round_not_draft' }

  const problemCount = await db
    .select({ id: roundProblemsTable.problemId })
    .from(roundProblemsTable)
    .where(eq(roundProblemsTable.roundId, id))
  if (problemCount.length === 0) return { ok: false, error: 'no_problems' }

  const openedAt = new Date()
  const closesAt = new Date(openedAt.getTime() + existing.durationMinutes * 60_000)
  try {
    await db
      .update(roundsTable)
      .set({ status: 'open', openedAt, closesAt, updatedAt: new Date() })
      .where(eq(roundsTable.id, id))
  } catch (error) {
    // The findOpenRound check above is a friendly pre-flight, not the actual
    // invariant: two concurrent opens on two different draft rounds can both
    // pass it before either commits. rounds_single_open_idx (db/schema.ts) is
    // the real source of truth, so a race loses here instead of at the read —
    // caught and reported the same as the friendly path, not left to bubble
    // to the generic onError envelope.
    // drizzle-orm wraps every driver error in its own DrizzleQueryError, with
    // the raw postgres-js error as `.cause` (see queryWithCache in
    // pg-core/session.ts) — the check has to look one level down.
    const cause = error instanceof Error ? error.cause : undefined
    if (
      cause instanceof postgres.PostgresError &&
      cause.constraint_name === 'rounds_single_open_idx'
    ) {
      return { ok: false, error: 'another_round_open' }
    }
    throw error
  }

  const detail = await getRound(db, id)
  if (!detail) throw new Error('expected round to still exist right after open')
  return { ok: true, round: detail }
}

export type ExtendRoundResult =
  | { ok: true; round: RoundDetail }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'round_not_open' }

export async function extendRound(db: Db, id: string, minutes: number): Promise<ExtendRoundResult> {
  await reapExpiredRound(db)

  const [existing] = await db.select().from(roundsTable).where(eq(roundsTable.id, id))
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'open' || !existing.closesAt)
    return { ok: false, error: 'round_not_open' }

  const closesAt = new Date(existing.closesAt.getTime() + minutes * 60_000)
  await db
    .update(roundsTable)
    .set({ closesAt, updatedAt: new Date() })
    .where(eq(roundsTable.id, id))

  const detail = await getRound(db, id)
  if (!detail) throw new Error('expected round to still exist right after extend')
  return { ok: true, round: detail }
}

// --- Participant access to a problem via its round (#37) ---

export type ProblemRoundAccess =
  | { status: 'open'; roundId: string }
  | { status: 'closed'; roundId: string }
  | { status: 'none' }

// A problem never in a round, or only in a draft one, is 'none' — the same
// "never announces itself" rule the participant read already applies to a
// draft problem. Open beats closed when a problem sits in both.
//
// 'closed' carries a roundId too (#176): a reused problem sits in several
// closed rounds, and the score the problem page shows has to be the score of
// one specific round — the most recently opened one, the round the
// participant has just played. Without it the page reduced over every round
// at once and disagreed with each round's own leaderboard.
export async function getProblemRoundAccess(
  db: Db,
  problemId: string,
): Promise<ProblemRoundAccess> {
  await reapExpiredRound(db)

  const rows = await db
    .select({ roundId: roundsTable.id, status: roundsTable.status, openedAt: roundsTable.openedAt })
    .from(roundProblemsTable)
    .innerJoin(roundsTable, eq(roundProblemsTable.roundId, roundsTable.id))
    .where(and(eq(roundProblemsTable.problemId, problemId), ne(roundsTable.status, 'draft')))

  const open = rows.find((row) => row.status === 'open')
  if (open) return { status: 'open', roundId: open.roundId }

  const mostRecent = rows
    .slice()
    .sort((a, b) => (b.openedAt?.getTime() ?? 0) - (a.openedAt?.getTime() ?? 0))[0]
  if (mostRecent) return { status: 'closed', roundId: mostRecent.roundId }
  return { status: 'none' }
}

// Reaps first so a round whose closesAt just passed is never seen as open —
// the client's timer is never the authority on whether a submission lands.
export async function isProblemInOpenRound(
  db: Db,
  roundId: string,
  problemId: string,
): Promise<boolean> {
  await reapExpiredRound(db)

  const [row] = await db
    .select({ id: roundsTable.id })
    .from(roundsTable)
    .innerJoin(roundProblemsTable, eq(roundProblemsTable.roundId, roundsTable.id))
    .where(
      and(
        eq(roundsTable.id, roundId),
        eq(roundsTable.status, 'open'),
        eq(roundProblemsTable.problemId, problemId),
      ),
    )
  return row !== undefined
}

export type CloseRoundResult =
  | { ok: true; round: RoundDetail }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'round_not_open' }

export async function closeRound(db: Db, id: string): Promise<CloseRoundResult> {
  await reapExpiredRound(db)

  const [existing] = await db.select().from(roundsTable).where(eq(roundsTable.id, id))
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'open') return { ok: false, error: 'round_not_open' }

  // closesAt is left untouched: the originally-promised deadline stays as
  // history, distinct from closedAt (the moment it actually ended early).
  await db
    .update(roundsTable)
    .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
    .where(eq(roundsTable.id, id))
  // Announced by the same drain as an expired round (#176): an organizer
  // closing early races judging exactly like the clock does.
  pendingClosures.set(id, new Date())

  const detail = await getRound(db, id)
  if (!detail) throw new Error('expected round to still exist right after close')
  return { ok: true, round: detail }
}

// --- Participant round detail (#39) ---

// Local copies of submissions.service.ts's findTeamIdForUser/getBestSubmission
// query shapes: that module already imports isProblemInOpenRound from this
// one, so importing back from here would create a rounds.service.ts <->
// submissions.service.ts circular import.
async function findTeamIdForParticipant(db: Db, userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ teamId: teamMembersTable.teamId })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, userId))
  return membership?.teamId ?? null
}

// One round trip for every problem in the round: rows come back sorted by
// score desc (then earliest createdAt on a tie), so the first row seen for a
// given problemId is already that problem's best submission.
async function getBestScoresForTeam(
  db: Db,
  teamId: string,
  problemIds: string[],
  roundId: string,
): Promise<Map<string, number>> {
  if (problemIds.length === 0) return new Map()

  const rows = await db
    .select({ problemId: submissionsTable.problemId, score: submissionsTable.score })
    .from(submissionsTable)
    .where(
      and(
        eq(submissionsTable.teamId, teamId),
        eq(submissionsTable.roundId, roundId),
        inArray(submissionsTable.problemId, problemIds),
      ),
    )
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.createdAt))

  const bestByProblem = new Map<string, number>()
  for (const row of rows) {
    if (!bestByProblem.has(row.problemId)) bestByProblem.set(row.problemId, row.score)
  }
  return bestByProblem
}

// The participant read of a round (#39): a missing round or one still
// 'draft' returns null — same "never announces itself" rule as
// listParticipantRounds. bestScore is the caller's team best on each
// problem, open or closed (#206: the team sees its own result mid-round,
// matching getPublishedProblem); null when the team never submitted it or the
// caller has no team.
export async function getParticipantRound(
  db: Db,
  id: string,
  locale: Locale,
  userId: string,
): Promise<ParticipantRoundDetail | null> {
  await reapExpiredRound(db)

  const [round] = await db.select().from(roundsTable).where(eq(roundsTable.id, id))
  if (!round || round.status === 'draft') return null

  const roundProblems = await db
    .select()
    .from(roundProblemsTable)
    .where(eq(roundProblemsTable.roundId, id))
  const problemIds = roundProblems.map((rp) => rp.problemId)

  const [problems, translations] = await Promise.all([
    problemIds.length === 0
      ? []
      : db.select().from(problemsTable).where(inArray(problemsTable.id, problemIds)),
    problemIds.length === 0
      ? []
      : db
          .select()
          .from(problemTranslationsTable)
          .where(inArray(problemTranslationsTable.problemId, problemIds)),
  ])

  const problemById = new Map(problems.map((problem) => [problem.id, problem]))
  const translationsByProblem = new Map<string, typeof translations>()
  for (const translation of translations) {
    const list = translationsByProblem.get(translation.problemId) ?? []
    list.push(translation)
    translationsByProblem.set(translation.problemId, list)
  }

  const teamId = await findTeamIdForParticipant(db, userId)
  const bestScores =
    teamId === null
      ? new Map<string, number>()
      : await getBestScoresForTeam(db, teamId, problemIds, round.id)

  return {
    id: round.id,
    name: round.name,
    status: round.status,
    durationMinutes: round.durationMinutes,
    openedAt: round.openedAt,
    closesAt: round.closesAt,
    closedAt: round.closedAt,
    problems: roundProblems
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((rp) => {
        const problem = problemById.get(rp.problemId)
        if (!problem) throw new Error('expected round problem to reference an existing problem')

        // pt is the fallback when the requested locale has no translation —
        // unreachable in practice since publishing requires every locale.
        const problemTranslations = translationsByProblem.get(rp.problemId) ?? []
        const translation =
          problemTranslations.find((t) => t.locale === locale) ??
          problemTranslations.find((t) => t.locale === 'pt')

        return {
          problemId: rp.problemId,
          position: rp.position,
          title: translation?.title ?? '',
          difficulty: problem.difficulty,
          points: problem.points,
          bestScore: bestScores.get(rp.problemId) ?? null,
        }
      }),
  }
}
