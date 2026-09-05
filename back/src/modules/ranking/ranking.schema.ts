import { z } from 'zod'

export const RankingProblemEntrySchema = z.object({
  problemId: z.string(),
  score: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
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

export const RoundRankingSchema = z.object({
  roundId: z.string(),
  roundName: z.string(),
  problemIds: z.array(z.string()),
  teams: z.array(RoundRankingTeamSchema),
})

export const RoundRankingParamsSchema = z.object({
  id: z.string(),
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

export type RankingProblemEntry = z.infer<typeof RankingProblemEntrySchema>
export type RoundRankingTeam = z.infer<typeof RoundRankingTeamSchema>
export type RoundRanking = z.infer<typeof RoundRankingSchema>
export type RoundRankingParams = z.infer<typeof RoundRankingParamsSchema>
export type EventRankingRoundEntry = z.infer<typeof EventRankingRoundEntrySchema>
export type EventRankingTeam = z.infer<typeof EventRankingTeamSchema>
export type EventRanking = z.infer<typeof EventRankingSchema>
