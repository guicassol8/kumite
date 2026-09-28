import { z } from 'zod'

// Mirrors back/src/modules/sse/sse.schema.ts. This channel is deliberately
// outside the typed RPC client (see sse.route.ts's note on why `/sse` isn't
// declared through `output`), so the wire contract is duplicated here by
// hand instead of inferred from AppType.

const RoundRefSchema = z.object({
  id: z.string(),
  closesAt: z.coerce.date().nullable(),
})

export const StateSyncEventSchema = z.object({
  type: z.literal('state.sync'),
  serverTime: z.coerce.date(),
  round: RoundRefSchema.nullable(),
  // Whether the organizer paused submissions (#285).
  submissionsPaused: z.boolean(),
})

export const RoundOpenedEventSchema = z.object({
  type: z.literal('round.opened'),
  serverTime: z.coerce.date(),
  roundId: z.string(),
  closesAt: z.coerce.date(),
})

export const RoundExtendedEventSchema = z.object({
  type: z.literal('round.extended'),
  serverTime: z.coerce.date(),
  roundId: z.string(),
  closesAt: z.coerce.date(),
})

export const RoundClosedEventSchema = z.object({
  type: z.literal('round.closed'),
  serverTime: z.coerce.date(),
  roundId: z.string(),
})

// The organizer paused or resumed submissions (#285). May repeat the current
// value — the reducer applies it idempotently.
export const SubmissionsPausedEventSchema = z.object({
  type: z.literal('submissions.paused'),
  serverTime: z.coerce.date(),
})

export const SubmissionsResumedEventSchema = z.object({
  type: z.literal('submissions.resumed'),
  serverTime: z.coerce.date(),
})

export const HeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  serverTime: z.coerce.date(),
})

// Mirrors back/src/modules/ranking/ranking.schema.ts.
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

// Whether the round's totals are comparable between teams (#193): see the
// back's DenominatorVerdictSchema for what each value means. Required, like
// the back — `z.object` strips unknown keys, so leaving it out of this mirror
// dropped the verdict from every live `ranking.updated` (#318).
export const DenominatorVerdictSchema = z.enum(['consistent', 'inconsistent', 'unknown'])

export const RoundRankingSchema = z.object({
  roundId: z.string(),
  roundName: z.string(),
  problemIds: z.array(z.string()),
  denominators: DenominatorVerdictSchema,
  teams: z.array(RoundRankingTeamSchema),
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

// Carries both scopes — the active round's live leaderboard (`null` when no
// round is open) and the event-wide leaderboard — in one event (#44 plan).
export const RankingUpdatedEventSchema = z.object({
  type: z.literal('ranking.updated'),
  serverTime: z.coerce.date(),
  round: RoundRankingSchema.nullable(),
  event: EventRankingSchema,
})

// The last frame of a stream whose account was deactivated (#291). Consumed
// by sse-client.ts itself — it stops the loop and drops the session — and
// never handed to the reducers in use-event-stream.ts.
export const SessionRevokedEventSchema = z.object({
  type: z.literal('session.revoked'),
  serverTime: z.coerce.date(),
})

export const SseEventSchema = z.discriminatedUnion('type', [
  StateSyncEventSchema,
  RoundOpenedEventSchema,
  RoundExtendedEventSchema,
  RoundClosedEventSchema,
  SubmissionsPausedEventSchema,
  SubmissionsResumedEventSchema,
  HeartbeatEventSchema,
  RankingUpdatedEventSchema,
  SessionRevokedEventSchema,
])

export type RankingProblemEntry = z.infer<typeof RankingProblemEntrySchema>
export type RoundRankingTeam = z.infer<typeof RoundRankingTeamSchema>
export type DenominatorVerdict = z.infer<typeof DenominatorVerdictSchema>
export type RoundRanking = z.infer<typeof RoundRankingSchema>
export type EventRankingRoundEntry = z.infer<typeof EventRankingRoundEntrySchema>
export type EventRankingTeam = z.infer<typeof EventRankingTeamSchema>
export type EventRanking = z.infer<typeof EventRankingSchema>
export type RankingUpdatedEvent = z.infer<typeof RankingUpdatedEventSchema>
export type SessionRevokedEvent = z.infer<typeof SessionRevokedEventSchema>
export type SseEvent = z.infer<typeof SseEventSchema>
