import { performance } from 'node:perf_hooks'

import { streamSSE } from 'hono/streaming'

import { defineRoute } from '../../context'
import { requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import type { SseEvent } from './sse.schema'
import {
  buildRankingUpdatedEventTimed,
  buildStateSyncEvent,
  sseConnectFinished,
  sseConnectStarted,
} from './sse.service'

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
  use: [requireUser, requirePasswordUpToDate],
  input: {},
  output: {},
  handler: async (c) => {
    const currentUser = c.get('currentUser')
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
      // Set once the stream reaches its final `await new Promise` below;
      // calling it ends the handler the same way `stream.onAbort` already
      // does, just triggered by a deactivation instead of a client hangup.
      let closeStream: (() => void) | undefined
      // Latched instead of relying on `closeStream` alone: a deactivation can
      // land while the snapshot below is still being built, when `closeStream`
      // is still `undefined` and there is nothing to call. The final
      // `await new Promise` reads this before it ever waits, so that race ends
      // the stream instead of leaving it open forever.
      let closed = false
      // Set only by a deactivation, never by a client hangup (`onAbort`): it is
      // what tells the handler to write the terminal `session.revoked` (#291)
      // once everything already queued has gone out. `endStream` itself stays
      // synchronous — it runs inside the bus subscriber — so the write happens
      // after the final `await new Promise` below instead of here.
      let revoked = false
      const endStream = () => {
        closed = true
        revoked = true
        unsubscribe()
        closeStream?.()
      }
      const unsubscribe = c.get('sseBus').subscribe((event) => {
        // #274: the bus also carries internal control events that never go to
        // the wire (see SseControlEvent in sse.schema.ts). Narrowing them out
        // first is what keeps `write` below reachable only by wire events —
        // and it replaces #232's per-heartbeat `findUserById`, which cost one
        // query per connection per second just to notice a deactivation.
        if (event.type === 'user.deactivated') {
          if (event.userId === currentUser.id) endStream()
          return
        }

        if (buffering) {
          pending.push(event)
          return
        }
        void write(event)
      })

      // #138: what the snapshot below costs, and how many were being built
      // at once — a reconnect storm is exactly that number going up.
      const started = performance.now()
      const concurrent = sseConnectStarted()
      let snapshotted = false
      try {
        const initial = await buildStateSyncEvent(c.get('db'))
        const stateSyncMs = performance.now() - started
        await write(initial)

        // Sent unconditionally, outside the debounce tick: every new
        // connection sees the current leaderboard immediately rather than
        // waiting up to 1s for the next dirty tick (#44 plan).
        const { event: initialRanking, stages } = await buildRankingUpdatedEventTimed(c.get('db'))
        await write(initialRanking)
        snapshotted = true
        sseConnectFinished({
          ...stages,
          stateSyncMs,
          totalMs: performance.now() - started,
          concurrent,
        })

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
        if (!snapshotted) sseConnectFinished(null)
        unsubscribe()
        throw error
      }

      await new Promise<void>((resolve) => {
        // Already ended while the snapshot was being built — never wait.
        if (closed) {
          resolve()
          return
        }
        closeStream = resolve
        stream.onAbort(() => {
          unsubscribe()
          resolve()
        })
      })

      // After the snapshot and any drained buffer, so the order on the wire is
      // always state.sync → … → session.revoked → end, even when the ban landed
      // mid-snapshot. Without this frame the client cannot tell a revoked
      // session from a dropped connection and reconnects just to be told 401.
      if (revoked) {
        try {
          await write({ type: 'session.revoked', serverTime: new Date() })
        } catch {
          // The client may have hung up at the same moment — nothing to tell.
        }
      }
    })
  },
})
