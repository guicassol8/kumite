import { defineRoute } from '../../context'

import { HealthSchema } from './health.schema'
import { checkHealth } from './health.service'

// Liveness probe: GET /health -> 200 {"status":"ok"}. The smallest valid Kata
// route — it declares input and output (ADR-0003), keeps its schema in
// health.schema.ts (ADR-0005), and uses no DI.
export const healthRoute = defineRoute({
  method: 'GET',
  path: '/health',
  input: {},
  output: HealthSchema,
  handler: () => checkHealth(),
})
