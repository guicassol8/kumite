import { and, asc, desc, eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { submissionsTable } from '../../db/schema'

import type { BestSubmission } from './submissions.schema'

// "Vale a melhor pontuação": the team's highest score on a problem, the moment
// it was reached (the tiebreaker) and how many attempts it took. Grouped by
// team, not user — the score belongs to the team (docs/product.md).
export async function getBestSubmission(
  db: Db,
  teamId: string,
  problemId: string,
): Promise<BestSubmission | null> {
  const [best] = await db
    .select({
      score: submissionsTable.score,
      achievedAt: submissionsTable.createdAt,
      // Postgres evaluates window functions before LIMIT, so `count(*) over ()`
      // is the full attempt count for this (team, problem) — one round trip
      // for both the best row and the total.
      attempts: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(submissionsTable)
    .where(and(eq(submissionsTable.teamId, teamId), eq(submissionsTable.problemId, problemId)))
    // Ties go to the earliest submission: reaching the score first wins.
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.createdAt))
    .limit(1)

  return best ?? null
}
