import { z } from 'zod'

import { UuidSchema } from '../../lib/uuid'

export const RankingProblemEntrySchema = z.object({
  problemId: z.string(),
  score: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  // The maximum this particular score was actually computed against — the
  // problem's `points` at judging time, stamped on the submission (#193) —
  // rather than the problem's `points` read live now. `null` for a submission
  // judged before the stamp existed, whose scale was never recorded.
  maxScore: z.number().int().nullable(),
})

export const RoundRankingTeamSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  rank: z.number().int().positive(),
  totalScore: z.number().int().nonnegative(),
  totalAttempts: z.number().int().nonnegative(),
  tiebreakTimeMs: z.number().int().nonnegative(),
  problems: z.array(RankingProblemEntrySchema),
})

/**
 * Whether this round's scores are on one scale (#193).
 *
 * - `consistent` — every counted submission of every problem was prorated over
 *   the same denominator, so the totals are comparable between teams.
 * - `inconsistent` — the same problem was judged against more than one
 *   denominator inside this round: someone changed its test cases or its points
 *   mid-round (which the guard in problems.service.ts now refuses, so this can
 *   only be history). The totals are NOT comparable, and nothing here pretends
 *   to repair them — rescaling would need each submission's passed-case count,
 *   which a rounded integer score does not give back.
 * - `unknown` — at least one counted submission predates the stamp, so its
 *   scale was never recorded and consistency cannot be asserted either way.
 */
export const DenominatorVerdictSchema = z.enum(['consistent', 'inconsistent', 'unknown'])

export const RoundRankingSchema = z.object({
  roundId: z.string(),
  roundName: z.string(),
  problemIds: z.array(z.string()),
  denominators: DenominatorVerdictSchema,
  teams: z.array(RoundRankingTeamSchema),
})

export const RoundRankingParamsSchema = z.object({
  id: UuidSchema,
})

export const EventRankingRoundEntrySchema = z.object({
  roundId: z.string(),
  roundName: z.string(),
  score: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  tiebreakTimeMs: z.number().int().nonnegative(),
})

export const EventRankingTeamSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  rank: z.number().int().positive(),
  totalScore: z.number().int().nonnegative(),
  totalAttempts: z.number().int().nonnegative(),
  tiebreakTimeMs: z.number().int().nonnegative(),
  rounds: z.array(EventRankingRoundEntrySchema),
})

export const EventRankingSchema = z.object({
  teams: z.array(EventRankingTeamSchema),
})

export type DenominatorVerdict = z.infer<typeof DenominatorVerdictSchema>
export type RankingProblemEntry = z.infer<typeof RankingProblemEntrySchema>
export type RoundRankingTeam = z.infer<typeof RoundRankingTeamSchema>
export type RoundRanking = z.infer<typeof RoundRankingSchema>
export type RoundRankingParams = z.infer<typeof RoundRankingParamsSchema>
export type EventRankingRoundEntry = z.infer<typeof EventRankingRoundEntrySchema>
export type EventRankingTeam = z.infer<typeof EventRankingTeamSchema>
export type EventRanking = z.infer<typeof EventRankingSchema>
