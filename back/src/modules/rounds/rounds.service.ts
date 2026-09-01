import { and, eq, lte } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { roundProblemsTable, roundsTable } from '../../db/schema'

import type { RoundDetail, RoundSummary } from './rounds.schema'

type RoundRow = typeof roundsTable.$inferSelect
type RoundProblemRow = typeof roundProblemsTable.$inferSelect

// Lazy expiry: a round past its own closesAt is closed here, on the read
// path, so nothing depends on a scheduler ever running. closedAt is set to
// the round's own closesAt (deterministic "closed exactly on schedule"), not
// to whenever this happened to run.
export async function reapExpiredRound(db: Db): Promise<void> {
  await db
    .update(roundsTable)
    .set({ status: 'closed', closedAt: roundsTable.closesAt, updatedAt: new Date() })
    .where(and(eq(roundsTable.status, 'open'), lte(roundsTable.closesAt, new Date())))
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

// Any round currently open, used by openRound to enforce "only one at a time"
// with a friendly error before the DB's own partial unique index would.
export async function findOpenRound(db: Db): Promise<RoundRow | null> {
  const [round] = await db.select().from(roundsTable).where(eq(roundsTable.status, 'open'))
  return round ?? null
}
