import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./session', () => ({ authHeader: () => ({}) }))

import { connectEventStream, SSE_RETRY_DELAY_MS } from './sse-client'

const encoder = new TextEncoder()

function frame(event: unknown): string {
  return `event: test\ndata: ${JSON.stringify(event)}\n\n`
}

// `andThenError`: after yielding every chunk, the stream errors instead of
// closing cleanly — the "stream error mid-read" case the reconnect loop
// must recover from.
function makeStream(chunks: string[], andThenError = false): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
        return
      }
      if (andThenError) {
        controller.error(new Error('simulated stream error'))
      } else {
        controller.close()
      }
    },
  })
}

const stateSync = {
  type: 'state.sync',
  serverTime: new Date().toISOString(),
  round: null,
}
const roundOpened = {
  type: 'round.opened',
  serverTime: new Date().toISOString(),
  roundId: 'r1',
  closesAt: new Date().toISOString(),
}

describe('connectEventStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('delivers parsed events in order, then reconnects once after a stream error', async () => {
    const firstChunk = frame(stateSync) + frame(roundOpened)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ body: makeStream([firstChunk], true) })
      .mockResolvedValueOnce({ body: makeStream([], false) })
    vi.stubGlobal('fetch', fetchMock)

    const onEvent = vi.fn()
    const disconnect = connectEventStream(onEvent)

    await vi.advanceTimersByTimeAsync(0)
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({ type: 'state.sync' })
    expect(onEvent.mock.calls[1]?.[0]).toMatchObject({ type: 'round.opened', roundId: 'r1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    disconnect()
  })

  it('stops reconnecting once disconnected', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ body: makeStream([], false) })
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    disconnect()

    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
