import { z } from 'zod'

import { JudgeTimingsSchema } from '../judge/judge.schema'
import { RoundStatusSchema } from '../rounds/rounds.schema'
import { SseTimingsSchema } from '../sse/sse.schema'

// --- Organizer event overview (#54) ---
//
// Read-only aggregate for the Painel's overview screen. Nothing here is
// stored: every field is derived on each request from users/teams/rounds/
// submissions.

// The round fields the overview card needs — a trimmed RoundSchema, without
// the CRUD-only columns (durationMinutes, createdAt, updatedAt) the card
// never renders.
export const StatsRoundRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: RoundStatusSchema,
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
})

export type StatsRoundRef = z.infer<typeof StatsRoundRefSchema>

export const EventStatsSchema = z.object({
  // Active participants only: organizers and deactivated accounts are not
  // "inscritos". `inTeam + withoutTeam === total` and
  // `pucrs + merida === total` both hold by construction.
  participants: z.object({
    total: z.number().int().nonnegative(),
    pucrs: z.number().int().nonnegative(),
    merida: z.number().int().nonnegative(),
    inTeam: z.number().int().nonnegative(),
    withoutTeam: z.number().int().nonnegative(),
  }),
  teams: z.object({
    total: z.number().int().nonnegative(),
    openSlots: z.number().int().nonnegative(),
    maxTeamSize: z.number().int().positive(),
  }),
  // `inRound` counts the reference round below (the open one, else the last
  // closed one) and is null when the event has no announced round at all.
  submissions: z.object({
    total: z.number().int().nonnegative(),
    inRound: z.number().int().nonnegative().nullable(),
  }),
  round: z.object({
    active: StatsRoundRefSchema.nullable(),
    lastClosed: StatsRoundRefSchema.nullable(),
  }),
})

export type EventStats = z.infer<typeof EventStatsSchema>

// --- Organizer live card (#279) ---
//
// Process-local counters, read from memory on every poll: nothing here comes
// from the database. They answer "is the judge stuck, or is the network
// down?" while a round is running.
const liveCount = z.number().int().nonnegative()

export const LiveStatsSchema = z.object({
  // `concurrency` is the judge's slot limit (JUDGE_CONCURRENCY): `inFlight`
  // never exceeds it, and `waiting` is how many submissions queue behind it.
  judge: z.object({
    inFlight: liveCount,
    waiting: liveCount,
    concurrency: z.number().int().positive(),
  }),
  // Open `/sse` streams in this process.
  sse: z.object({ connections: liveCount }),
  // `inFlight` is teams with a submission being handled right now.
  // `perMinute` is acceptances per minute over the last 15, oldest first, and
  // `lastMinute === perMinute[14]` by construction.
  submissions: z.object({
    inFlight: liveCount,
    lastMinute: liveCount,
    perMinute: z.array(liveCount).length(15),
  }),
})

export type LiveStats = z.infer<typeof LiveStatsSchema>

// --- Process metrics for the load harness (#136) ---
//
// What only the process itself can measure: CPU, memory and event-loop lag.
// Read by `back/src/load/` while it drives load, never shown on a screen. A
// read resets nothing — CPU is cumulative and the windows are a ring — so
// two pollers (the harness and an organizer tab) never steal each other's
// samples. The harness derives CPU % from the difference between two reads
// and merges windows by `endedAt`.
const nonNegative = z.number().nonnegative()

// One closed event-loop window. Delays are in milliseconds; a window in which
// the histogram recorded nothing reports zeros, never NaN or a sentinel.
export const EventLoopWindowSchema = z.object({
  // Epoch milliseconds at which the window closed.
  endedAt: z.number().int().nonnegative(),
  durationMs: nonNegative,
  delayP50Ms: nonNegative,
  delayP99Ms: nonNegative,
  delayMaxMs: nonNegative,
  // Event-loop utilization over the window, in [0, 1].
  utilization: z.number().min(0).max(1),
})

export type EventLoopWindow = z.infer<typeof EventLoopWindowSchema>

export const ProcessStatsSchema = z.object({
  sampledAt: z.number().int().nonnegative(),
  uptimeSeconds: nonNegative,
  // Cumulative since the process started (process.cpuUsage()), and therefore
  // including the judge's worker threads.
  cpu: z.object({ userMicros: nonNegative, systemMicros: nonNegative }),
  // Bytes, straight from process.memoryUsage().
  memory: z.object({
    rss: nonNegative,
    heapUsed: nonNegative,
    heapTotal: nonNegative,
    external: nonNegative,
  }),
  // `windowMs` is null when no sampler runs (unit tests, a script that only
  // imports the app); `windows` is then empty. Oldest first.
  eventLoop: z.object({
    windowMs: z.number().int().positive().nullable(),
    windows: z.array(EventLoopWindowSchema),
  }),
  // #137: the judge's runs (arrival, queue, spawn, execution), its worker
  // counters and the configuration it judges with.
  judge: JudgeTimingsSchema,
  // #138: each emission's fan-out and snapshot cost, and each connect's.
  sse: SseTimingsSchema,
})

export type ProcessStats = z.infer<typeof ProcessStatsSchema>

// `since` (epoch ms) keeps only the judge runs, SSE emissions and connects
// that ended at or after it: a poller passes its previous `sampledAt` and
// receives what is new, so every poll's output — validated in production
// too — stays proportional to the traffic, not to the rings. The event-loop
// windows are not filtered.
export const ProcessStatsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().optional(),
})

export type ProcessStatsQuery = z.infer<typeof ProcessStatsQuerySchema>
