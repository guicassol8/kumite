import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  api: { me: { $get: vi.fn() } },
}))

import { api } from './api'
import type { SessionUser } from './session'

const mockedGetMe = vi.mocked(api.me.$get)

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stub
function meResponse(status: number, body: unknown): any {
  return { status, json: async () => body }
}

// The store is a module-level singleton — resetModules + a fresh dynamic
// import give each test its own instance. `./api` stays mocked across resets
// (vitest keeps mock factories alive), so its call history is cleared by hand.
function loadSession() {
  return import('./session')
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  mockedGetMe.mockReset()
})

describe('session store', () => {
  it('hydrates to authenticated on a successful /me', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(200, fakeUser))
    const session = await loadSession()

    await session.ensureHydrated()

    expect(session.getState()).toMatchObject({
      status: 'authenticated',
      user: fakeUser,
      token: 'tok-1',
    })
  })

  it('hydrates to anonymous and clears the token on a 401', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(401, { error: 'unauthorized', message: 'nope' }))
    const session = await loadSession()

    await session.ensureHydrated()

    expect(session.getState()).toMatchObject({ status: 'anonymous', user: null, token: null })
    expect(localStorage.getItem('kumite-token')).toBeNull()
  })

  it('resolves to anonymous without calling /me when there is no stored token', async () => {
    const session = await loadSession()

    await session.ensureHydrated()

    expect(session.getState().status).toBe('anonymous')
    expect(mockedGetMe).not.toHaveBeenCalled()
  })

  it('only fetches /me once across concurrent and repeated ensureHydrated calls', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(200, fakeUser))
    const session = await loadSession()

    await Promise.all([session.ensureHydrated(), session.ensureHydrated()])
    await session.ensureHydrated()

    expect(mockedGetMe).toHaveBeenCalledTimes(1)
  })

  it('setSession persists the token and flips to authenticated', async () => {
    const session = await loadSession()

    session.setSession(fakeUser, 'tok-2')

    expect(session.getState()).toMatchObject({
      status: 'authenticated',
      user: fakeUser,
      token: 'tok-2',
    })
    expect(localStorage.getItem('kumite-token')).toBe('tok-2')
  })

  it.each(['manual', 'expired'] as const)(
    'clearSession(%s) resets state and storage',
    async (reason) => {
      const session = await loadSession()
      session.setSession(fakeUser, 'tok-3')

      session.clearSession(reason)

      expect(session.getState()).toMatchObject({
        status: 'anonymous',
        user: null,
        token: null,
        reason,
      })
      expect(localStorage.getItem('kumite-token')).toBeNull()
    },
  )

  // #175, achado #19: the cache outlived the session, so the next account on
  // the same browser rendered the previous one's teams/rounds/rankings until a
  // background refetch replaced them.
  it.each(['manual', 'expired'] as const)(
    'clearSession(%s) empties the React Query cache',
    async (reason) => {
      // Same `resetModules` registry as `loadSession`, so this is the very
      // instance `clearSession` reaches for.
      const { queryClient } = await import('./query-client')
      const session = await loadSession()
      session.setSession(fakeUser, 'tok-4')
      queryClient.setQueryData(['teams'], [{ id: 't1', name: 'Time do Aluno 1' }])
      expect(queryClient.getQueryCache().getAll()).toHaveLength(1)

      session.clearSession(reason)

      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(queryClient.getQueryData(['teams'])).toBeUndefined()
    },
  )
})

// #179: a `GET /me` that rejects (network blip, back restarting) used to be
// cached as a rejected promise — `status` stayed `'loading'` forever and every
// later `ensureHydrated()` re-threw the same error, so F5 was the only way
// out. Fake timers keep the 0/500/1500ms backoff from costing 2s per test.
describe('hydration with a failing /me (#179)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // The retries live behind `setTimeout`, so the promise only settles after
  // the fake clock is drained — awaiting it first would deadlock the test.
  async function settle<T>(promise: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync()
    return promise
  }

  it('resolves instead of rejecting when the request fails', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()

    await expect(settle(session.ensureHydrated())).resolves.toBeUndefined()
  })

  it('leaves the loading state once the retries are exhausted', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(session.getState().status).not.toBe('loading')
  })

  it('does not cache the failure: the next ensureHydrated tries /me again', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()

    await settle(session.ensureHydrated())
    const afterFirst = mockedGetMe.mock.calls.length

    await settle(session.ensureHydrated())

    expect(mockedGetMe.mock.calls.length).toBeGreaterThan(afterFirst)
  })

  it('lands in error with the token intact, so a retry still has one to send', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(session.getState()).toMatchObject({ status: 'error', user: null, token: 'tok-1' })
    expect(localStorage.getItem('kumite-token')).toBe('tok-1')
  })

  it('retries three times before giving up', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(mockedGetMe).toHaveBeenCalledTimes(3)
  })

  it('recovers on a later attempt without the caller noticing', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(meResponse(200, fakeUser))
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(session.getState()).toMatchObject({ status: 'authenticated', user: fakeUser })
  })

  // A proxy that accepts the connection and never answers is the same stuck
  // screen as a refused one, so every attempt carries its own 8s abort signal.
  // The mock only rejects when that signal fires, which is also what pins the
  // signal to actually reach the request.
  it('aborts an attempt that never answers and still reaches error', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockImplementation(
      // biome-ignore lint/suspicious/noExplicitAny: the hc client's own options type
      (_args?: any, options?: any) =>
        new Promise((_resolve, reject) => {
          const signal: AbortSignal | undefined = options?.init?.signal
          signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(session.getState().status).toBe('error')
    expect(localStorage.getItem('kumite-token')).toBe('tok-1')
  })

  // A 503 from a back that is restarting is not a logout. Before #179 the
  // `else` branch wiped the token on *any* non-200, so a 30s deploy signed
  // the whole auditorium out for real.
  it('keeps the token through a 503 instead of treating it as a logout', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(503, { error: 'unavailable' }))
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(session.getState()).toMatchObject({ status: 'error', token: 'tok-1' })
    expect(localStorage.getItem('kumite-token')).toBe('tok-1')
  })

  it('treats a 401 as an expired session, not a retryable failure', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(401, { error: 'unauthorized' }))
    const session = await loadSession()

    await settle(session.ensureHydrated())

    expect(session.getState()).toMatchObject({ status: 'anonymous', reason: 'expired' })
    expect(localStorage.getItem('kumite-token')).toBeNull()
    expect(mockedGetMe).toHaveBeenCalledTimes(1)
  })

  // The root keys the retry card off 'error'. If a retry dropped the status to
  // 'loading' the card would unmount, the route underneath would flash for the
  // two seconds of the cycle, and the button's "Tentando…" would go with it.
  it('stays in error for the whole retry instead of flickering through loading', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()
    await settle(session.ensureHydrated())

    const seen: string[] = []
    const unsubscribe = session.subscribe(() => seen.push(session.getState().status))
    await settle(session.retryHydration())
    unsubscribe()

    expect(seen).not.toContain('loading')
    expect(session.getState().status).toBe('error')
  })

  it('retryHydration runs a fresh cycle and authenticates, with no reload', async () => {
    localStorage.setItem('kumite-token', 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const session = await loadSession()
    await settle(session.ensureHydrated())
    expect(session.getState().status).toBe('error')

    mockedGetMe.mockReset()
    mockedGetMe.mockResolvedValue(meResponse(200, fakeUser))
    await settle(session.retryHydration())

    expect(session.getState()).toMatchObject({
      status: 'authenticated',
      user: fakeUser,
      token: 'tok-1',
    })
  })
})

// One-shot refresh of `/me`, used by /change-password right after the 204
// (#190). Unlike `ensureHydrated` it never retries, never parks the session in
// 'error' and never invents a user: the calling screen owns the retry UI.
describe('refreshSession', () => {
  it('adopts the fresh user and reports ok', async () => {
    const session = await loadSession()
    session.setSession({ ...fakeUser, mustChangePassword: true }, 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(200, fakeUser))

    await expect(session.refreshSession()).resolves.toBe('ok')

    expect(session.getState()).toMatchObject({
      status: 'authenticated',
      user: fakeUser,
      token: 'tok-1',
    })
  })

  it('reports unauthorized and drops the session on a 401', async () => {
    const session = await loadSession()
    session.setSession(fakeUser, 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(401, { error: 'unauthorized' }))

    await expect(session.refreshSession()).resolves.toBe('unauthorized')

    expect(session.getState()).toMatchObject({ status: 'anonymous', reason: 'expired' })
    expect(localStorage.getItem('kumite-token')).toBeNull()
  })

  it('reports unauthorized on a 403 too', async () => {
    const session = await loadSession()
    session.setSession(fakeUser, 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(403, { error: 'forbidden' }))

    await expect(session.refreshSession()).resolves.toBe('unauthorized')
    expect(session.getState().status).toBe('anonymous')
  })

  // A 502/503 is the back restarting, not a logout — and not an 'error'
  // either: parking the session there would swap /change-password for the
  // root's retry card and lose the news that the password *did* change.
  it('reports failed on a 5xx without touching the session', async () => {
    const session = await loadSession()
    const flagged = { ...fakeUser, mustChangePassword: true }
    session.setSession(flagged, 'tok-1')
    mockedGetMe.mockResolvedValue(meResponse(502, { error: 'bad_gateway' }))

    await expect(session.refreshSession()).resolves.toBe('failed')

    expect(session.getState()).toMatchObject({
      status: 'authenticated',
      user: flagged,
      token: 'tok-1',
    })
    expect(localStorage.getItem('kumite-token')).toBe('tok-1')
  })

  it('reports failed instead of rejecting when the request dies', async () => {
    const session = await loadSession()
    session.setSession(fakeUser, 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(session.refreshSession()).resolves.toBe('failed')
    expect(session.getState().status).toBe('authenticated')
  })

  it('reports failed without calling /me when there is no token', async () => {
    const session = await loadSession()

    await expect(session.refreshSession()).resolves.toBe('failed')
    expect(mockedGetMe).not.toHaveBeenCalled()
  })
})

// A `/me` that neither answers nor fails is the other half of "the refresh
// failed": `attemptHydration` has guarded its own call with an 8s
// AbortController since #179, and without the same guard here the screen sits
// on a disabled button forever — the "stuck with nothing on screen" symptom
// #190 exists to remove.
describe('refreshSession against a /me that never answers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('gives up and reports failed instead of hanging forever', async () => {
    const session = await loadSession()
    session.setSession(fakeUser, 'tok-1')
    mockedGetMe.mockImplementation((_input, options) => {
      const signal = options?.init?.signal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })

    const outcome = session.refreshSession()
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(outcome).resolves.toBe('failed')
    // The session is untouched, exactly as on any other 'failed'.
    expect(session.getState()).toMatchObject({ status: 'authenticated', token: 'tok-1' })
  })
})
