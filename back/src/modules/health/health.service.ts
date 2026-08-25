import type { Health } from './health.schema'

// Services are plain, pure functions (no framework imports) — trivial to unit
// test. The route is the only place that knows about HTTP.
export function checkHealth(): Health {
  return { status: 'ok' }
}
