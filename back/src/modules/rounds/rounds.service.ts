import { and, eq, inArray, lte } from 'drizzle-orm'
import postgres from 'postgres'

import type { Db } from '../../db/client'
import { problemsTable, roundProblemsTable, roundsTable } from '../../db/schema'

import type { CreateRoundBody, RoundDetail, RoundSummary, UpdateRoundBody } from './rounds.schema'

type RoundRow = typeof roundsTable.$inferSelect
type RoundProblemRow = typeof roundProblemsTable.$inferSelect

export type ReapedRound = { id: string; closesAt: Date | null }

// Lazy expiry: a round past its own closesAt is closed here, on the read
// path, so nothing depends on a scheduler ever running. closedAt is set to
// the round's own closesAt (deterministic "closed exactly on schedule"), not
// to whenever this happened to run. Returns the round(s) this call actually
// closed (empty when nothing was expired) so callers — the SSE tick — know
// what to announce without a second query.
export async function reapExpiredRound(db: Db): Promise<ReapedRound[]> {
  return db
    .update(roundsTable)
    .set({ status: 'closed', closedAt: roundsTable.closesAt, updatedAt: new Date() })
    .where(and(eq(roundsTable.status, 'open'), lte(roundsTable.closesAt, new Date())))
    .returning({ id: roundsTable.id, closesAt: roundsTable.closesAt })
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
// the participant read in problems.service.ts).
async function hasOnlyPublishedProblems(db: Db, problemIds: string[]): Promise<boolean> {
  if (problemIds.length === 0) return true
  const rows = await db
    .select({ id: problemsTable.id })
    .from(problemsTable)
    .where(and(inArray(problemsTable.id, problemIds), eq(problemsTable.status, 'published')))
  return rows.length === problemIds.length
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

  const detail = await getRound(db, id)
  if (!detail) throw new Error('expected round to still exist right after close')
  return { ok: true, round: detail }
}
