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
