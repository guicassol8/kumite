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
