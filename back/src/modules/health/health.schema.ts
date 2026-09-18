import { z } from 'zod'

// Response DTO for GET /health (ADR-0005). Schemas live in their own *.schema.ts
// so they can be reused by name and imported by the route.
//
// `degraded` (#287): the API process is up but its database is not answering.
// Served with a 503 so Caddy, the CI's wait-on and any uptime check stop
// treating a back with a dead Postgres as healthy.
export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
})

export type Health = z.infer<typeof HealthSchema>
