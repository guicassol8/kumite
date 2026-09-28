import { z } from 'zod'

import { RoundStatusSchema } from '../rounds/rounds.schema'

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
