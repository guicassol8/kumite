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
  // Whether the organizer paused submissions (#285). In the snapshot so a
  // client that (re)connects mid-pause knows it without waiting on a toggle.
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

// The organizer paused or resumed submissions (#285). Published on every
// PATCH /organizer/event-config that carries `submissionsPaused`, even when
// the value did not change — consumers apply it idempotently. The round and
// its timer are untouched either way.
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

// Carries both scopes — the active round's live leaderboard (`null` when no
// round is open) and the event-wide leaderboard — in one event, rather than
// two separate types, since every consumer wants both together (#44 plan).
export const RankingUpdatedEventSchema = z.object({
  type: z.literal('ranking.updated'),
  serverTime: z.coerce.date(),
  round: RoundRankingSchema.nullable(),
  event: EventRankingSchema,
})

// The last frame of a stream whose account was deactivated (#291), written
// right before the handler closes it. Without it a clean end looked exactly
// like a network drop, so the client reconnected and only learned the truth
// from that reconnect's 401. Per connection, never broadcast — see
// `SseBroadcastEvent` below — and deliberately carrying nothing that
// identifies the user: the connection it lands on already knows whose it is.
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

export type StateSyncEvent = z.infer<typeof StateSyncEventSchema>
export type RoundOpenedEvent = z.infer<typeof RoundOpenedEventSchema>
export type RoundExtendedEvent = z.infer<typeof RoundExtendedEventSchema>
export type RoundClosedEvent = z.infer<typeof RoundClosedEventSchema>
export type SubmissionsPausedEvent = z.infer<typeof SubmissionsPausedEventSchema>
export type SubmissionsResumedEvent = z.infer<typeof SubmissionsResumedEventSchema>
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>
export type RankingUpdatedEvent = z.infer<typeof RankingUpdatedEventSchema>
export type SessionRevokedEvent = z.infer<typeof SessionRevokedEventSchema>
export type SseEvent = z.infer<typeof SseEventSchema>

// --- Internal control events (#274) ---
//
// Deliberately NOT part of `SseEventSchema`, and deliberately not a zod schema
// at all: this never crosses the wire and is therefore never serialized or
// parsed. It travels only inside the process, on the same `sseBus`, so `/sse`
// can drop the stream of an account an organizer just deactivated — replacing
// #232's per-connection `findUserById` on every heartbeat, which cost one
// query per connection per second (600-800/s at the event's target scale).
//
// Staying out of the wire union is a security property, not tidiness: the
// front mirrors `SseEventSchema` by hand in `front/src/lib/sse-schema.ts`, and
// a `user.deactivated` written to the stream would hand one user's id to every
// other connected client. `write()` in sse.route.ts stays typed as
// `(event: SseEvent) => …`, so the compiler forces the route to narrow the
// control events out before anything is written.
//
// In-memory and process-local, exactly like `rankingDirty`,
// `pendingRoundClosures`, `inFlightIdentities` and the bug-report window:
// `docker-compose.prod.yml` runs a single `back` service with no replicas.
// A second process would not see the event and its streams would stay open
// until the client reconnects and fails `requireUser`.
export type UserDeactivatedEvent = { type: 'user.deactivated'; userId: string }

export type SseControlEvent = UserDeactivatedEvent

// The rule runs both ways (#291). `user.deactivated` is on the bus but never
// on the wire; `session.revoked` is on the wire but never on the bus. It is
// per-connection — the route writes it to the one stream it is ending — and a
// `bus.publish` of it would reach every subscriber and log out every connected
// client at once. Excluding it here makes that publish a type error.
/** Wire events that fan out to every connection. */
export type SseBroadcastEvent = Exclude<SseEvent, SessionRevokedEvent>

/** Everything the bus carries: the broadcast wire events plus the internal ones. */
export type SseBusEvent = SseBroadcastEvent | SseControlEvent

// --- Timings for the load harness (#138) ---
//
// What the fan-out and the connect snapshot cost, as GET
// /organizer/stats/process reports it. Durations in milliseconds, instants in
// epoch milliseconds; `seq` increases by one per entry of its own ring and is
// what the harness dedupes by.
const nonNegative = z.number().nonnegative()
const count = z.number().int().nonnegative()

// The three queries a full `ranking.updated` runs, in order.
export const RankingStagesSchema = z.object({
  openRoundMs: nonNegative,
  roundRankingMs: nonNegative,
  eventRankingMs: nonNegative,
})

export const SseEmissionSchema = z.object({
  seq: z.number().int().positive(),
  endedAt: count,
  kind: z.enum(['ranking', 'heartbeat']),
  // Bus subscribers at publish time: the open streams.
  subscribers: count,
  // The synchronous part of `bus.publish`: the frame encoded once, in the
  // first subscriber (#439), plus N writes of it queued. The socket write
  // itself happens after it.
  publishMs: nonNegative,
  // Building the snapshot, for a ranking tick; null for a heartbeat.
  stages: RankingStagesSchema.nullable(),
})

export const SseConnectSchema = RankingStagesSchema.extend({
  seq: z.number().int().positive(),
  endedAt: count,
  // Building `state.sync`.
  stateSyncMs: nonNegative,
  // From the handler's start until the snapshot's ranking frame was written.
  totalMs: nonNegative,
  // Snapshots being built when this one started, itself included.
  concurrent: z.number().int().positive(),
})

export const SseTimingsSchema = z.object({
  // Oldest first, the last 256 and 1024.
  emissions: z.array(SseEmissionSchema),
  connects: z.array(SseConnectSchema),
})

export type RankingStages = z.infer<typeof RankingStagesSchema>
export type SseEmission = z.infer<typeof SseEmissionSchema>
export type SseConnect = z.infer<typeof SseConnectSchema>
export type SseTimings = z.infer<typeof SseTimingsSchema>
