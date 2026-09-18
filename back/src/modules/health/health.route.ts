import { defineRoute } from '../../context'

import { HealthSchema } from './health.schema'
import { checkHealth, pingDatabase } from './health.service'

// Liveness probe: GET /health -> 200 {"status":"ok"} while Postgres answers
// `select 1` within HEALTH_DB_TIMEOUT_MS, 503 {"status":"degraded"} otherwise
// (#287). Still the smallest Kata route — it declares input and output
// (ADR-0003) and keeps its schema in health.schema.ts (ADR-0005) — it just
// reads the `db` slot now instead of answering from nothing.
export const healthRoute = defineRoute({
  method: 'GET',
  path: '/health',
  input: {},
  output: { 200: HealthSchema, 503: HealthSchema },
  handler: async (c) => {
    const db = c.get('db')
    const health = await checkHealth(() => pingDatabase(db))
    return c.json(health, health.status === 'ok' ? 200 : 503)
  },
})
