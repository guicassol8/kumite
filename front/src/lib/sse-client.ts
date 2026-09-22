import { authFetch } from './api'
import { authHeader } from './session'
import { type SseEvent, SseEventSchema } from './sse-schema'

// Browser `EventSource` can't send an `Authorization` header, and this
// channel is authenticated — so it's a hand-rolled fetch-based reader
// instead of the standard SSE client. No polyfill, no backend change.
//
// `authFetch` and not the global `fetch` (#189): it is the one place that
// turns "a 401 on a request that carried our token" into
// `clearSession('expired')`, which the root converts into the bounce to
// /login. Going around it is what left the expired token in storage while
// this loop kept reconnecting.
export const SSE_RETRY_DELAY_MS = 2000

// The delay doubles from the base and stops growing here, so a long outage
// settles into one attempt every 30s instead of 2s.
export const SSE_RETRY_MAX_DELAY_MS = 30_000

// Consecutive failures before the loop gives up. With the schedule above that
// is ~3.5min of unavailability — long enough to ride out a back restart or a
// venue wifi blip, short enough that an unattended tab stops hammering.
// Reset by every connection that actually opens.
export const SSE_MAX_RETRIES = 10

function sseUrl(): string {
  return `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/sse`
}

function nextDelayMs(consecutiveFailures: number): number {
  return Math.min(SSE_RETRY_DELAY_MS * 2 ** (consecutiveFailures - 1), SSE_RETRY_MAX_DELAY_MS)
}

// Frames are separated by a blank line (SSE framing); the payload's own
// `type` field already discriminates the event, so only the `data:` line
// is read here — the `event:` line sse.route.ts also sends is redundant
// for parsing and safely ignored.
function consumeFrames(buffer: string, onEvent: (event: SseEvent) => void): string {
  const frames = buffer.split('\n\n')
  const remainder = frames.pop() ?? ''
  for (const frame of frames) {
    const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) continue
    try {
      const parsed = SseEventSchema.safeParse(JSON.parse(dataLine.slice('data:'.length).trim()))
      if (parsed.success) onEvent(parsed.data)
    } catch {
      // Malformed frame — skip it rather than crash the reader.
    }
  }
  return remainder
}

// 'error' (#189) is the stream reporting that it is NOT connected and knows
// why: a rejected response, or the retry cap exhausted. Consumers must treat
// it like 'reconnecting' — never like 'open'.
export type SseConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'error'

// Connects, delivers parsed events to `onEvent`, and reconnects with an
// exponential backoff whenever the stream ends or errors — until the returned
// function is called, the retry cap is hit, or the response says retrying is
// pointless. Returns that disconnect function. `onStatusChange`, when given,
// is notified 'connecting' before the first attempt, 'reconnecting' before
// every later one, 'open' once the response body starts streaming, and
// 'error' whenever an attempt is rejected or the cap runs out.
export function connectEventStream(
  onEvent: (event: SseEvent) => void,
  onStatusChange?: (status: SseConnectionStatus) => void,
): () => void {
  let stopped = false
  let controller: AbortController | null = null
  // Consecutive failures since the last connection that opened.
  let failures = 0
  // Non-null only while the loop is parked waiting for the environment to
  // come back; calling it detaches the listeners.
  let detachRearm: (() => void) | null = null

  function clearRearm(): void {
    detachRearm?.()
    detachRearm = null
  }

  // The cap stops the hammering, but the venue's big screen sits unattended
  // for hours with nobody to press the leaderboard's retry button — and
  // /rounds/$id has no REST fallback at all. So the one recoverable terminal
  // state, "the network was down too long", re-arms itself when the browser
  // says another attempt is worth making. The 401/403 terminals deliberately
  // never get here: a rejected token stays rejected.
  function armRearm(): void {
    if (stopped || detachRearm) return
    const resume = (): void => {
      clearRearm()
      if (stopped) return
      failures = 0
      void run(true)
    }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') resume()
    }
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', onVisibilityChange)
    detachRearm = () => {
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  async function run(resumed = false): Promise<void> {
    let first = !resumed
    while (!stopped) {
      onStatusChange?.(first ? 'connecting' : 'reconnecting')
      first = false
      controller = new AbortController()
      try {
        const res = await authFetch(sseUrl(), {
          headers: authHeader(),
          signal: controller.signal,
        })

        // THE TRAP BEHIND #189: a rejected `/sse` response still has a body —
        // kata's error envelope — so `res.body.getReader()` below succeeds on
        // a 401 and the old code went straight on to announce 'open'. The
        // status has to be checked BEFORE the body is touched.
        if (!res.ok) {
          onStatusChange?.('error')
          // 401: `authFetch` just dropped the session and the root is already
          // navigating to /login. 403 on this route is only ever
          // `requirePasswordUpToDate`, which the root sends to
          // /change-password with the session intact — deliberately unlike
          // `attemptHydration`, where `/me` is exempt from that middleware so
          // a 403 there cannot mean "change your password". Either way,
          // reconnecting would produce the identical response.
          if (res.status === 401 || res.status === 403) return
          throw new Error(`sse responded ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('sse response has no body')

        failures = 0
        onStatusChange?.('open')
        const decoder = new TextDecoder()
        let buffer = ''
        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          buffer = consumeFrames(buffer, onEvent)
        }
      } catch {
        // Network error, abort, a missing body or a retryable status —
        // handled uniformly by the backoff below.
      }

      if (stopped) break
      failures += 1
      if (failures > SSE_MAX_RETRIES) {
        onStatusChange?.('error')
        armRearm()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, nextDelayMs(failures)))
    }
  }

  void run()

  return () => {
    stopped = true
    clearRearm()
    controller?.abort()
  }
}
