import { z } from 'zod'

// Mirrors the `rounds` drizzle table (db/schema.ts).
export const RoundStatusSchema = z.enum(['draft', 'open', 'closed'])

export const RoundSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  status: RoundStatusSchema,
  durationMinutes: z.number().int().positive(),
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RoundStatus = z.infer<typeof RoundStatusSchema>
export type Round = z.infer<typeof RoundSchema>
export type NewRound = Pick<Round, 'name' | 'durationMinutes'>

// Mirrors the `round_problems` drizzle table (db/schema.ts).
export const RoundProblemSchema = z.object({
  roundId: z.string(),
  problemId: z.string(),
  position: z.number().int().nonnegative(),
})

export type RoundProblem = z.infer<typeof RoundProblemSchema>
