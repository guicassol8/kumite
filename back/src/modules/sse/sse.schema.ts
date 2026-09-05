import { z } from 'zod'

import { EventRankingSchema, RoundRankingSchema } from '../ranking/ranking.schema'

// The `/sse` wire contract (#38). Discriminated on `type` so the leaderboard
// epic can add its own variant later without touching the existing ones.

const RoundRefSchema = z.object({
  id: z.string(),
  closesAt: z.coerce.date().nullable(),
})

// Sent first on every connect/reconnect, before any incremental event, so a
// client always knows the current round state without waiting on one.
export const StateSyncEventSchema = z.object({
  type: z.literal('state.sync'),
  serverTime: z.coerce.date(),
  round: RoundRefSchema.nullable(),
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

export const HeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  serverTime: z.coerce.date(),
})

// Carries both scopes — the active round's live leaderboard (`null` when no
// round is open) and the event-wide leaderboard — in one event, rather than
// two separate types, since every consumer wants both together (#44 plan).
export const RankingUpdatedEventSchema = z.object({
  type: z.literal('ranking.updated'),
  serverTime: z.coerce.date(),
  round: RoundRankingSchema.nullable(),
  event: EventRankingSchema,
})

export const SseEventSchema = z.discriminatedUnion('type', [
  StateSyncEventSchema,
  RoundOpenedEventSchema,
  RoundExtendedEventSchema,
  RoundClosedEventSchema,
  HeartbeatEventSchema,
  RankingUpdatedEventSchema,
])

export type StateSyncEvent = z.infer<typeof StateSyncEventSchema>
export type RoundOpenedEvent = z.infer<typeof RoundOpenedEventSchema>
export type RoundExtendedEvent = z.infer<typeof RoundExtendedEventSchema>
export type RoundClosedEvent = z.infer<typeof RoundClosedEventSchema>
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>
export type RankingUpdatedEvent = z.infer<typeof RankingUpdatedEventSchema>
export type SseEvent = z.infer<typeof SseEventSchema>
