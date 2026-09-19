import { z } from 'zod'

// Mirrors the `event_config` drizzle table (db/schema.ts).
export const EventConfigSchema = z.object({
  id: z.number(),
  mixingLocked: z.boolean(),
  maxTeamSize: z.number().int().positive(),
  updatedAt: z.coerce.date(),
})

export type EventConfig = z.infer<typeof EventConfigSchema>

/**
 * Product ceiling on the configured team size (#187). The hard floor is the
 * column — `max_team_size` is a Postgres `integer` (db/schema.ts) — so before
 * this cap a value past 2_147_483_647 passed zod and died in the UPDATE as a
 * 500 with no `issues`, which is exactly the "try again" dead end the issue
 * describes. Ten is the product limit for the PUCRS × Mérida event (the seed
 * runs teams of 3) and reads well inside the form's message.
 *
 * Deliberately not on `EventConfigSchema`: that one describes the row read
 * back and kata re-validates handler output against it, so a stored row above
 * the ceiling must still serialize.
 *
 * Mirrored in the front as `MAX_TEAM_SIZE_MAX` (front/src/lib/field-limits.ts);
 * tests on both sides pin the literal, so a drift breaks the suite.
 */
export const EVENT_MAX_TEAM_SIZE = 10

export const UpdateEventConfigBodySchema = z.object({
  mixingLocked: z.boolean().optional(),
  maxTeamSize: z.number().int().positive().max(EVENT_MAX_TEAM_SIZE).optional(),
})

export type UpdateEventConfigBody = z.infer<typeof UpdateEventConfigBodySchema>
