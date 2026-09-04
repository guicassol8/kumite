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

export const SseEventSchema = z.discriminatedUnion('type', [
  StateSyncEventSchema,
  RoundOpenedEventSchema,
  RoundExtendedEventSchema,
  RoundClosedEventSchema,
  HeartbeatEventSchema,
])

export type SseEvent = z.infer<typeof SseEventSchema>
