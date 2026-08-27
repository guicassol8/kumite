import { z } from 'zod'

import { UniversitySchema } from '../users/users.schema'

// Schema-only for now — no route/service until a future task consumes event
// codes at signup. Mirrors the `event_codes` drizzle table (db/schema.ts).
export const EventCodeSchema = z.object({
  code: z.string(),
  university: UniversitySchema,
  allowedEmailSuffixes: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type EventCode = z.infer<typeof EventCodeSchema>
