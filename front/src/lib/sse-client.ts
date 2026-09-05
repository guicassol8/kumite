import { authHeader } from './session'
import { type SseEvent, SseEventSchema } from './sse-schema'

// Browser `EventSource` can't send an `Authorization` header, and this
// channel is authenticated — so it's a hand-rolled fetch-based reader
// instead of the standard SSE client. No polyfill, no backend change.
export const SSE_RETRY_DELAY_MS = 2000

function sseUrl(): string {
  return `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/sse`
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

export type SseConnectionStatus = 'connecting' | 'open' | 'reconnecting'

// Connects, delivers parsed events to `onEvent`, and reconnects after a
// fixed delay whenever the stream ends or errors — until the returned
// function is called. Returns that disconnect function. `onStatusChange`,
// when given, is notified 'connecting' before every attempt (initial and
// each reconnect), 'open' once the response body starts streaming, and
// 'reconnecting' when a run ends and the retry delay begins.
export function connectEventStream(
  onEvent: (event: SseEvent) => void,
  onStatusChange?: (status: SseConnectionStatus) => void,
): () => void {
  let stopped = false
  let controller: AbortController | null = null

  async function run(): Promise<void> {
    let first = true
    while (!stopped) {
      onStatusChange?.(first ? 'connecting' : 'reconnecting')
      first = false
      controller = new AbortController()
      try {
        const res = await fetch(sseUrl(), { headers: authHeader(), signal: controller.signal })
        const reader = res.body?.getReader()
        if (!reader) throw new Error('sse response has no body')

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
        // Network error, abort, or a missing body — handled uniformly by
        // the retry below.
      }

      if (stopped) break
      await new Promise((resolve) => setTimeout(resolve, SSE_RETRY_DELAY_MS))
    }
  }

  void run()

  return () => {
    stopped = true
    controller?.abort()
  }
}
