import { z } from 'zod'

import { UniversitySchema } from '../users/users.schema'

// Mirrors the `event_codes` drizzle table (db/schema.ts).
export const EventCodeSchema = z.object({
  code: z.string(),
  university: UniversitySchema,
  allowedEmailSuffixes: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type EventCode = z.infer<typeof EventCodeSchema>

export const EventCodeListSchema = z.array(EventCodeSchema)

export const EventCodeParamsSchema = z.object({
  university: UniversitySchema,
})

export const UpdateEventCodeBodySchema = z.object({
  code: z.string().min(1).optional(),
  allowedEmailSuffixes: z.array(z.string().min(1)).min(1).optional(),
  active: z.boolean().optional(),
})

export type EventCodeParams = z.infer<typeof EventCodeParamsSchema>
export type UpdateEventCodeBody = z.infer<typeof UpdateEventCodeBodySchema>
