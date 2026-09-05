import { streamSSE } from 'hono/streaming'

import { defineRoute } from '../../context'
import { requireUser } from '../../middlewares/auth'

import { buildRankingUpdatedEvent, buildStateSyncEvent } from './sse.service'

// 401 (requireUser) short-circuits before output validation runs (kata
// ADR-0011), same as every other guarded route — not declared here.
//
// `200` is deliberately left out of `output`: kata's `raw()` output contract
// validates the body via `response.clone().text()` in strict mode (the
// dev/test/CI default), which would hang forever against a heartbeat-driven
// stream that never closes, and kata has no per-route `outputValidation`
// override today (see kata-feedback/ for the framework gap this is logged
// against). Leaving `200` undeclared is the same escape hatch every 401
// short-circuit above already relies on: the response is a bare,
// unvalidated `Response`, not typed through `hc<AppType>` — the front hits
// this endpoint with a plain fetch-based SSE client, not the RPC client.
export const sseRoute = defineRoute({
  method: 'GET',
  path: '/sse',
  use: [requireUser],
  input: {},
  output: {},
  handler: async (c) => {
    return streamSSE(c.raw, async (stream) => {
      const initial = await buildStateSyncEvent(c.get('db'))
      await stream.writeSSE({ event: initial.type, data: JSON.stringify(initial) })

      // Sent unconditionally, outside the debounce tick: every new
      // connection sees the current leaderboard immediately rather than
      // waiting up to 1s for the next dirty tick (#44 plan).
      const initialRanking = await buildRankingUpdatedEvent(c.get('db'))
      await stream.writeSSE({ event: initialRanking.type, data: JSON.stringify(initialRanking) })

      const unsubscribe = c.get('sseBus').subscribe((event) => {
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
      })

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          unsubscribe()
          resolve()
        })
      })
    })
  },
})
