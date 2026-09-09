import { z } from 'zod'

import { UuidSchema } from '../../lib/uuid'

// All Zod schemas for a domain live here, never inline in the route (ADR-0005) —
// the route imports them by name. Export the z.infer types alongside so a single
// import pulls both the runtime validator and the compile-time type.
export const CreateGreetingBodySchema = z.object({
  name: z.string().min(1),
})

export const GreetingParamsSchema = z.object({
  id: UuidSchema,
})

export const GreetingSchema = z.object({
  id: z.string(),
  message: z.string(),
})

export type CreateGreetingBody = z.infer<typeof CreateGreetingBodySchema>
export type Greeting = z.infer<typeof GreetingSchema>
