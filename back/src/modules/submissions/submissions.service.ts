import { and, asc, desc, eq, sql } from 'drizzle-orm'

import { SUBMISSION_COOLDOWN_MS } from '../../config'
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
