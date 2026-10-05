// Incremental text/event-stream parsing for the load harness (#136). Pure:
// chunks in, frames out. The harness reads `/sse` with fetch (the route
// authenticates by header, so EventSource is out, same as the front).

export type SseFrame = {
  event: string | null
  data: string
  id: string | null
}

/**
 * Feeds arbitrary chunks, emits one frame per blank-line-terminated block.
 * Handles `\n\n` and `\r\n\r\n`, several `data:` lines (joined with `\n`),
 * `:` comments, and a frame split across chunks. A block with no data line
 * dispatches nothing (the spec's rule); an unterminated tail is held until
 * the next chunk and dropped if the stream ends first.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void) {
  let buffer = ''

  const dispatch = (block: string) => {
    let event: string | null = null
    let id: string | null = null
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line === '' || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'data') data.push(value)
      else if (field === 'event') event = value
      else if (field === 'id') id = value
    }
    if (data.length === 0) return
    onFrame({ event, data: data.join('\n'), id })
  }

  return {
    push(chunk: string) {
      // A `\r` at the end of one chunk pairs with the `\n` that opens the
      // next, so normalize the whole buffer, not just the new chunk.
      buffer = (buffer + chunk).replace(/\r\n/g, '\n')
      let end = buffer.indexOf('\n\n')
      while (end !== -1) {
        dispatch(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
        end = buffer.indexOf('\n\n')
      }
    },
  }
}

export type ByteStats = { count: number; total: number; min: number; max: number }

export type EventTally = {
  // Events of each type on this connection.
  counts: Record<string, number>
  // Milliseconds between consecutive heartbeats on this connection.
  heartbeatIntervalsMs: number[]
  // The largest of them; null before the second heartbeat (#138).
  maxHeartbeatGapMs: number | null
  // Payload bytes per type (#138).
  bytes: Record<string, ByteStats>
  // The time each type first arrived, on the caller's clock (#138).
  firstAt: Record<string, number>
}

/**
 * Per-connection event counts, payload bytes, first arrivals and the gaps
 * between heartbeats. Timestamps are passed in, never read from a clock here,
 * so the gaps are testable without measuring anything (#431).
 */
export function createEventTally() {
  const counts: Record<string, number> = {}
  const heartbeatIntervalsMs: number[] = []
  const bytes: Record<string, ByteStats> = {}
  const firstAt: Record<string, number> = {}
  let lastHeartbeat: number | null = null
  let maxGap: number | null = null

  return {
    record(type: string, at: number, size = 0) {
      counts[type] = (counts[type] ?? 0) + 1
      firstAt[type] ??= at
      const stats = bytes[type]
      if (stats) {
        stats.count += 1
        stats.total += size
        stats.min = Math.min(stats.min, size)
        stats.max = Math.max(stats.max, size)
      } else {
        bytes[type] = { count: 1, total: size, min: size, max: size }
      }
      if (type !== 'heartbeat') return
      if (lastHeartbeat !== null) {
        const gap = at - lastHeartbeat
        heartbeatIntervalsMs.push(gap)
        if (maxGap === null || gap > maxGap) maxGap = gap
      }
      lastHeartbeat = at
    },
    snapshot(): EventTally {
      return {
        counts: { ...counts },
        heartbeatIntervalsMs: [...heartbeatIntervalsMs],
        maxHeartbeatGapMs: maxGap,
        bytes: structuredClone(bytes),
        firstAt: { ...firstAt },
      }
    },
  }
}
