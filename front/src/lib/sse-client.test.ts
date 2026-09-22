import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clearSession = vi.fn()

// `authHeader` returns a real token on purpose: `authFetch` (lib/api.ts) is
// NOT mocked here, and it only drops the session on a 401 that carried our own
// Authorization header. Mocking the header away would make the 401 look like a
// plain API answer and hide the very wiring acceptance #4 asks for.
vi.mock('./session', () => ({
  authHeader: () => ({ Authorization: 'Bearer test-token' }),
  clearSession: (...args: unknown[]) => clearSession(...args),
}))

import {
  connectEventStream,
  SSE_MAX_RETRIES,
  SSE_RETRY_DELAY_MS,
  SSE_RETRY_MAX_DELAY_MS,
} from './sse-client'

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

// A real `/sse` response the client should stream. `ok` matters: since #189
// the client refuses to read a body it was not told is a 2xx.
// Deliberately not annotated `Partial<Response>`: lib.dom types `body` as
// `ReadableStream<Uint8Array<ArrayBuffer>>`, while `makeStream` produces the
// wider `Uint8Array<ArrayBufferLike>` — and the client only reads `ok`,
// `status` and `body` anyway.
function okResponse(chunks: string[], andThenError = false) {
  return { ok: true, status: 200, body: makeStream(chunks, andThenError) }
}

// The trap behind #189: a non-ok `/sse` answer still HAS a body — kata's error
// envelope — so `res.body.getReader()` succeeds and the old client announced
// 'open' with a dead token. These fixtures keep that body in place.
function errorResponse(status: number) {
  return {
    ok: false,
    status,
    body: makeStream([JSON.stringify({ error: { code: 'unauthorized' } })]),
  }
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
const rankingUpdatedWithRound = {
  type: 'ranking.updated',
  serverTime: new Date().toISOString(),
  round: {
    roundId: 'r1',
    roundName: 'Rodada 1',
    problemIds: ['p1'],
    teams: [
      {
        teamId: 't1',
        teamName: 'Time 1',
        rank: 1,
        totalScore: 100,
        totalAttempts: 1,
        tiebreakTimeMs: 5000,
        problems: [{ problemId: 'p1', score: 100, attempts: 1 }],
      },
    ],
  },
  event: {
    teams: [
      {
        teamId: 't1',
        teamName: 'Time 1',
        rank: 1,
        totalScore: 100,
        totalAttempts: 1,
        tiebreakTimeMs: 5000,
        rounds: [
          { roundId: 'r1', roundName: 'Rodada 1', score: 100, attempts: 1, tiebreakTimeMs: 5000 },
        ],
      },
    ],
  },
}
const rankingUpdatedNoRound = {
  type: 'ranking.updated',
  serverTime: new Date().toISOString(),
  round: null,
  event: { teams: [] },
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
      .mockResolvedValueOnce(okResponse([firstChunk], true))
      .mockResolvedValueOnce(okResponse([]))
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
    const fetchMock = vi.fn().mockResolvedValue(okResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    disconnect()

    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('delivers ranking.updated events, with a populated and a null round', async () => {
    const chunk = frame(rankingUpdatedWithRound) + frame(rankingUpdatedNoRound)
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse([chunk]))
    vi.stubGlobal('fetch', fetchMock)

    const onEvent = vi.fn()
    const disconnect = connectEventStream(onEvent)

    await vi.advanceTimersByTimeAsync(0)
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({
      type: 'ranking.updated',
      round: { roundId: 'r1' },
    })
    expect(onEvent.mock.calls[1]?.[0]).toMatchObject({ type: 'ranking.updated', round: null })

    disconnect()
  })

  it('reports connecting -> open -> reconnecting -> open on a mid-stream error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse([frame(stateSync)], true))
      .mockResolvedValueOnce(okResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(vi.fn(), onStatusChange)

    await vi.advanceTimersByTimeAsync(0)
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual(['connecting', 'open'])

    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS)
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual([
      'connecting',
      'open',
      'reconnecting',
      'open',
    ])

    disconnect()
  })
})

// #189: a 401 on `/sse` used to be announced as 'open' (the error envelope is
// a body, so `getReader()` succeeded), the dead token stayed in storage and
// the client hammered the back every 2s for as long as the tab was open.
describe('connectEventStream — non-ok responses (#189)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearSession.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('never reports open on a 401: drops the session and stops retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401))
    vi.stubGlobal('fetch', fetchMock)

    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(vi.fn(), onStatusChange)

    await vi.advanceTimersByTimeAsync(0)
    const statuses = onStatusChange.mock.calls.map((call) => call[0])
    expect(statuses).not.toContain('open')
    expect(statuses.at(-1)).toBe('error')
    // Not done here: `authFetch` owns it, which is the single session-drop
    // path the rest of the front already goes through.
    expect(clearSession).toHaveBeenCalledWith('expired')

    // Terminal — a token the back just rejected will be rejected again.
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    disconnect()
  })

  it('stops retrying on a 403 and leaves the session alone', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(403))
    vi.stubGlobal('fetch', fetchMock)

    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(vi.fn(), onStatusChange)

    await vi.advanceTimersByTimeAsync(0)
    const statuses = onStatusChange.mock.calls.map((call) => call[0])
    expect(statuses).not.toContain('open')
    expect(statuses.at(-1)).toBe('error')
    // On `/sse` a 403 is `requirePasswordUpToDate`: the account is fine, the
    // password is stale. Logging it out would take away the one screen that
    // can fix it.
    expect(clearSession).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    disconnect()
  })

  it('reports a 500 as an error and keeps retrying it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500))
    vi.stubGlobal('fetch', fetchMock)

    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(vi.fn(), onStatusChange)

    await vi.advanceTimersByTimeAsync(0)
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual(['connecting', 'error'])
    expect(clearSession).not.toHaveBeenCalled()

    // A back that is restarting is worth another try, at the base delay.
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    disconnect()
  })
})

describe('connectEventStream — backoff and retry cap (#189)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearSession.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('doubles the delay between consecutive failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 2s, then 4s, then 8s — asserted just before and just after each
    // boundary, so a wrong delay cannot pass by being merely "eventually".
    for (const [index, delay] of [
      SSE_RETRY_DELAY_MS,
      SSE_RETRY_DELAY_MS * 2,
      SSE_RETRY_DELAY_MS * 4,
    ].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(fetchMock).toHaveBeenCalledTimes(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchMock).toHaveBeenCalledTimes(index + 2)
    }

    disconnect()
  })

  it('saturates the delay and gives up after SSE_MAX_RETRIES failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(vi.fn(), onStatusChange)

    // Doubling puts attempts 1..5 at 0, 2s, 6s, 14s and 30s (+2, +4, +8,
    // +16). The next step would be +32s, which the ceiling clamps to +30s —
    // so attempt 6 lands at 60s, and that boundary is what pins the cap.
    await vi.advanceTimersByTimeAsync(14_000)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(16_000)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(SSE_RETRY_MAX_DELAY_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(6)

    // Ten minutes of dead network: the cap is the whole point — one initial
    // attempt plus SSE_MAX_RETRIES retries, and then silence.
    for (let i = 0; i < 10; i += 1) await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(SSE_MAX_RETRIES + 1)
    expect(onStatusChange.mock.calls.at(-1)?.[0]).toBe('error')

    disconnect()
  })

  it('resets the backoff after a connection that opened', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse([]))
      .mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())

    // 0s, +2s, +4s — the third attempt is the one that opens and closes.
    await vi.advanceTimersByTimeAsync(6_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // Back to the base delay, not to the 8s the counter was heading for.
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(4)

    disconnect()
  })
})

// The cap would otherwise be a one-way door, and the venue's big screen has
// nobody standing next to it to press "retry" — plus /rounds/$id has no REST
// fallback at all. So the "network was down too long" terminal re-arms itself
// when the browser says the environment came back.
describe('connectEventStream — re-arming after the cap (#189)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearSession.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // The full schedule is 2+4+8+16+30*6 = 210s; 10 minutes of timers is well
  // past it, so the loop is parked by the time this returns.
  async function exhaustTheCap(): Promise<void> {
    for (let i = 0; i < 10; i += 1) await vi.advanceTimersByTimeAsync(60_000)
  }

  it('reopens the stream when the network comes back', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(vi.fn(), onStatusChange)

    await exhaustTheCap()
    expect(fetchMock).toHaveBeenCalledTimes(SSE_MAX_RETRIES + 1)

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(SSE_MAX_RETRIES + 2)
    // 'reconnecting', not 'connecting': the banner's existing copy stays
    // true, which is why #189 needs no new i18n key.
    expect(onStatusChange.mock.calls.at(-2)?.[0]).toBe('reconnecting')

    disconnect()
  })

  it('reopens the stream when the tab becomes visible again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())
    await exhaustTheCap()
    const parked = fetchMock.mock.calls.length

    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(parked + 1)

    disconnect()
  })

  it('counts the cap from scratch after re-arming', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())
    await exhaustTheCap()
    expect(fetchMock).toHaveBeenCalledTimes(SSE_MAX_RETRIES + 1)

    window.dispatchEvent(new Event('online'))
    await exhaustTheCap()

    // A fresh budget, not a single extra attempt — and it stops again.
    expect(fetchMock).toHaveBeenCalledTimes((SSE_MAX_RETRIES + 1) * 2)

    disconnect()
  })

  it('leaves no listener behind after disconnect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())
    await exhaustTheCap()
    const parked = fetchMock.mock.calls.length

    disconnect()

    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 4)
    expect(fetchMock).toHaveBeenCalledTimes(parked)
  })
})
