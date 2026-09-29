import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clearSession = vi.fn()
// What `getState()` reports. The client reads it before dropping the session
// on `session.revoked`, the same guard `attemptHydration` uses, so a session
// something else already dropped is not dropped (and redirected) twice.
const sessionState = { status: 'authenticated' as string }

// `authHeader` returns a real token on purpose: `authFetch` (lib/api.ts) is
// NOT mocked here, and it only drops the session on a 401 that carried our own
// Authorization header. Mocking the header away would make the 401 look like a
// plain API answer and hide the very wiring acceptance #4 asks for.
vi.mock('./session', () => ({
  authHeader: () => ({ Authorization: 'Bearer test-token' }),
  clearSession: (...args: unknown[]) => clearSession(...args),
  getState: () => sessionState,
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
  submissionsPaused: false,
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
    denominators: 'consistent',
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
    rounds: [{ roundId: 'r1', roundName: 'Rodada 1', denominators: 'consistent' }],
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
  event: { rounds: [], teams: [] },
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

  // #291 baseline: before `session.revoked` existed, #326 already got a banned
  // account to /login — but only through the side effect of the NEXT attempt:
  // the stream ends cleanly, the loop reconnects after the base delay, and
  // that reconnect's 401 drops the session. Pinned here so the improvement in
  // the `session.revoked` block below is measured against a known floor.
  it('drops the session on the 401 of the reconnect after a clean end, then stops', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse([frame(stateSync)]))
      .mockResolvedValue(errorResponse(401))
    vi.stubGlobal('fetch', fetchMock)

    const onEvent = vi.fn()
    const disconnect = connectEventStream(onEvent)

    await vi.advanceTimersByTimeAsync(0)
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(clearSession).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(clearSession).toHaveBeenCalledWith('expired')

    await vi.advanceTimersByTimeAsync(SSE_RETRY_MAX_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

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
    // The listener test below spies on add/removeEventListener; leaving those
    // spies up would follow the suite into every later test in this file.
    vi.restoreAllMocks()
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

  it('starts one loop, not two, when online and visibilitychange both fire', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())
    await exhaustTheCap()
    const parked = fetchMock.mock.calls.length

    // `resume` detaches both listeners before it restarts the loop, so the
    // second and third events land on nothing. Two concurrent loops would
    // double every retry from here on.
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(parked + 1)

    disconnect()
  })

  // Counted, not inferred. Asserting only that no fetch follows a disconnect
  // would pass with the listeners still attached — `resume` bails on
  // `stopped` anyway, so a leak would be invisible that way. What leaks
  // across a mount/unmount cycle is the registration itself.
  it('leaves no listener behind, across repeated mount/unmount cycles', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503))
    vi.stubGlobal('fetch', fetchMock)

    const live = new Map<string, number>()
    for (const target of [window, document] as const) {
      const add = target.addEventListener.bind(target)
      const remove = target.removeEventListener.bind(target)
      const count = (type: string, delta: number): void => {
        if (type === 'online' || type === 'visibilitychange') {
          live.set(type, (live.get(type) ?? 0) + delta)
        }
      }
      vi.spyOn(target, 'addEventListener').mockImplementation(((
        type: string,
        listener: never,
        options: never,
      ) => {
        count(type, 1)
        return add(type, listener, options)
      }) as never)
      vi.spyOn(target, 'removeEventListener').mockImplementation(((
        type: string,
        listener: never,
        options: never,
      ) => {
        count(type, -1)
        return remove(type, listener, options)
      }) as never)
    }

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const disconnect = connectEventStream(vi.fn())
      await exhaustTheCap()
      expect(Object.fromEntries(live)).toEqual({ online: 1, visibilitychange: 1 })
      disconnect()
      expect(Object.fromEntries(live)).toEqual({ online: 0, visibilitychange: 0 })
    }

    // And the re-arm itself is balanced: resuming detaches, parking again
    // re-attaches exactly one of each.
    const disconnect = connectEventStream(vi.fn())
    await exhaustTheCap()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(Object.fromEntries(live)).toEqual({ online: 0, visibilitychange: 0 })
    await exhaustTheCap()
    expect(Object.fromEntries(live)).toEqual({ online: 1, visibilitychange: 1 })

    disconnect()
    expect(Object.fromEntries(live)).toEqual({ online: 0, visibilitychange: 0 })

    // Still inert too, which is what the old assertion covered.
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    const parked = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 4)
    expect(fetchMock).toHaveBeenCalledTimes(parked)
  })
})

// #291: the back now ends a deactivated account's stream with an explicit
// `session.revoked` frame. Before it, a clean end was indistinguishable from a
// network drop: the loop showed "reconnecting" for SSE_RETRY_DELAY_MS and only
// the reconnect's 401 got the user to /login (the baseline pinned above).
describe('connectEventStream — session.revoked (#291)', () => {
  const sessionRevoked = { type: 'session.revoked', serverTime: new Date().toISOString() }

  beforeEach(() => {
    vi.useFakeTimers()
    clearSession.mockClear()
    sessionState.status = 'authenticated'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('drops the session at once and never reconnects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse([frame(stateSync) + frame(sessionRevoked)]))
      // Would be served if the loop wrongly came back: a 200 that ends cleanly
      // keeps a broken client reconnecting instead of failing loudly.
      .mockResolvedValue(okResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const onEvent = vi.fn()
    const onStatusChange = vi.fn()
    const disconnect = connectEventStream(onEvent, onStatusChange)

    await vi.advanceTimersByTimeAsync(0)
    // The terminal frame is the client's business, not the reducers'.
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({ type: 'state.sync' })
    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(clearSession).toHaveBeenCalledWith('expired')
    const statuses = onStatusChange.mock.calls.map((call) => call[0])
    expect(statuses).toEqual(['connecting', 'open', 'error'])

    await vi.advanceTimersByTimeAsync(SSE_RETRY_MAX_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual(statuses)

    // Terminal like a 401, not like the retry cap: the environment coming
    // back must not re-arm a stream whose session is gone.
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    disconnect()
  })

  it('stops at session.revoked even mid-chunk, ignoring anything after it', async () => {
    const chunk = frame(stateSync) + frame(roundOpened) + frame(sessionRevoked) + frame(stateSync)
    const fetchMock = vi.fn().mockResolvedValue(okResponse([chunk]))
    vi.stubGlobal('fetch', fetchMock)

    const onEvent = vi.fn()
    const disconnect = connectEventStream(onEvent)

    await vi.advanceTimersByTimeAsync(0)
    expect(onEvent.mock.calls.map((call) => call[0].type)).toEqual(['state.sync', 'round.opened'])
    expect(clearSession).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(SSE_RETRY_MAX_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    disconnect()
  })

  it('does not drop a session that is already anonymous a second time', async () => {
    sessionState.status = 'anonymous'
    const fetchMock = vi.fn().mockResolvedValue(okResponse([frame(sessionRevoked)]))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())

    await vi.advanceTimersByTimeAsync(SSE_RETRY_MAX_DELAY_MS)
    expect(clearSession).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    disconnect()
  })

  // Criterion 3: only the explicit frame is terminal. A stream that simply
  // ends is still a drop and is retried at the base delay.
  it('still reconnects after a clean end without session.revoked', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([frame(stateSync)]))
    vi.stubGlobal('fetch', fetchMock)

    const disconnect = connectEventStream(vi.fn())

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(SSE_RETRY_DELAY_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(clearSession).not.toHaveBeenCalled()

    disconnect()
  })
})
