import { z } from 'zod'

// Mirrors the `event_config` drizzle table (db/schema.ts).
export const EventConfigSchema = z.object({
  id: z.number(),
  mixingLocked: z.boolean(),
  maxTeamSize: z.number().int().positive(),
  updatedAt: z.coerce.date(),
})

export type EventConfig = z.infer<typeof EventConfigSchema>

export const UpdateEventConfigBodySchema = z.object({
  mixingLocked: z.boolean().optional(),
  maxTeamSize: z.number().int().positive().optional(),
})

export type UpdateEventConfigBody = z.infer<typeof UpdateEventConfigBodySchema>
