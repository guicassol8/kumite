import { z } from 'zod'

// Response DTO for GET /health (ADR-0005). Schemas live in their own *.schema.ts
// so they can be reused by name and imported by the route.
export const HealthSchema = z.object({
  status: z.literal('ok'),
})

export type Health = z.infer<typeof HealthSchema>
