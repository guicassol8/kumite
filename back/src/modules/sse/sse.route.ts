import { streamSSE } from 'hono/streaming'

import { defineRoute } from '../../context'
import { requireUser } from '../../middlewares/auth'

import type { SseEvent } from './sse.schema'
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
      const write = (event: SseEvent) =>
        stream.writeSSE({ event: event.type, data: JSON.stringify(event) })

      // Subscribed BEFORE the snapshot below, and buffered until it has been
      // written (#150). Subscribing afterwards left a window two queries and
      // two writes wide in which a published event reached nobody: a
      // `round.opened` lost there never came back, and the participant sat on
      // "waiting for the next round" until a reload — the client only learns
      // the current round from `state.sync` or `round.opened`
      // (front/src/hooks/use-event-stream.ts).
      let buffering = true
      const pending: SseEvent[] = []
      const unsubscribe = c.get('sseBus').subscribe((event) => {
        if (buffering) {
          pending.push(event)
          return
        }
        void write(event)
      })

      try {
        const initial = await buildStateSyncEvent(c.get('db'))
        await write(initial)

        // Sent unconditionally, outside the debounce tick: every new
        // connection sees the current leaderboard immediately rather than
        // waiting up to 1s for the next dirty tick (#44 plan).
        const initialRanking = await buildRankingUpdatedEvent(c.get('db'))
        await write(initialRanking)

        // Drained by index, not iterated: an event published while a buffered
        // one is being written lands in `pending` too and must go out in turn.
        // `buffering` flips with no `await` after the last drain, so nothing
        // can slip in between and be dropped.
        while (pending.length > 0) {
          const event = pending.shift() as SseEvent
          await write(event)
        }
        buffering = false
      } catch (error) {
        unsubscribe()
        throw error
      }

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          unsubscribe()
          resolve()
        })
      })
    })
  },
})
