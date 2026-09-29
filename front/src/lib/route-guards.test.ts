import { isRedirect } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Only the #179 block below drives a real hydration; the rest of the file
// never touches the API. The mock is here so that one can fail `/me` on
// purpose without the jsdom network guard firing.
vi.mock('./api', () => ({
  api: { me: { $get: vi.fn() } },
}))

import { api } from './api'
import { requireAuth, requireRole, requireSession } from './route-guards'
import { clearSession, getState, retryHydration, type SessionUser, setSession } from './session'

const mockedGetMe = vi.mocked(api.me.$get)

const participant: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const organizer: SessionUser = { ...participant, id: 'u2', role: 'organizer' }

const ctx = { location: { href: '/organizer' } }

beforeEach(() => {
  clearSession('manual')
})

describe('requireAuth', () => {
  it('redirects an anonymous user to /login, preserving the return route', async () => {
    let caught: unknown
    try {
      await requireAuth(ctx)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({ options: { to: '/login', search: { redirect: '/organizer' } } })
  })

  it('does not throw for an authenticated user', async () => {
    setSession(participant, 'tok-1')

    await expect(requireAuth(ctx)).resolves.toBeUndefined()
  })
})

describe('requireRole', () => {
  it('redirects an anonymous user to /login', async () => {
    let caught: unknown
    try {
      await requireRole('organizer')(ctx)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({ options: { to: '/login', search: { redirect: '/organizer' } } })
  })

  it('redirects a wrongly-roled user to / with the forbidden notice', async () => {
    setSession(participant, 'tok-1')

    let caught: unknown
    try {
      await requireRole('organizer')(ctx)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({
      options: { to: '/', search: { notice: 'forbidden-organizer' } },
    })
  })

  it('does not throw for a correctly-roled user', async () => {
    setSession(organizer, 'tok-2')

    await expect(requireRole('organizer')(ctx)).resolves.toBeUndefined()
  })
})

describe('forced password change (#143)', () => {
  const flagged: SessionUser = { ...participant, mustChangePassword: true }

  it('sends a flagged user to /change-password instead of the guarded screen', async () => {
    setSession(flagged, 'tok-1')

    let caught: unknown
    try {
      await requireAuth(ctx)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({ options: { to: '/change-password' } })
  })

  // #190: without the notice the user lands on a screen they did not ask for,
  // with no idea which click was refused or why.
  it('carries the reason for the bounce in the search params', async () => {
    setSession(flagged, 'tok-1')

    let caught: unknown
    try {
      await requireAuth(ctx)
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      options: { to: '/change-password', search: { notice: 'required' } },
    })
  })

  it('applies to role-guarded screens too, before the role is even checked', async () => {
    setSession({ ...organizer, mustChangePassword: true }, 'tok-2')

    let caught: unknown
    try {
      await requireRole('organizer')(ctx)
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({ options: { to: '/change-password' } })
  })

  // /change-password itself uses requireSession, or the guard would bounce the
  // one screen that can clear the flag straight back into itself.
  it('requireSession lets a flagged user through', async () => {
    setSession(flagged, 'tok-1')

    await expect(requireSession(ctx)).resolves.toBeUndefined()
  })

  it('requireSession still bounces an anonymous caller to /login', async () => {
    let caught: unknown
    try {
      await requireSession(ctx)
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({ options: { to: '/login', search: { redirect: '/organizer' } } })
  })
})

// #179: when hydration gives up, the root paints a full-screen retry card over
// the outlet. Every guard therefore has to stand down — a redirect here would
// swap that card for a login screen (or, for requireRole, for a "you are not
// an organizer" banner) on the strength of a user object that was never
// fetched.
describe('hydration in the error state (#179)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    mockedGetMe.mockReset()
  })

  // The guards await `ensureHydrated()`, and from the error state that starts
  // a fresh 0/500/1500ms cycle (the failed one is deliberately not cached) —
  // so the fake clock has to be drained while the guard is in flight, not
  // before it.
  async function settle<T>(promise: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync()
    return promise
  }

  // `setSession` + `retryHydration` is the only way in from outside the store:
  // it parks a token in state and then fails every attempt on it.
  async function enterErrorState(): Promise<void> {
    setSession(participant, 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    await settle(retryHydration())
    expect(getState().status).toBe('error')
  }

  // A cold deep link to a guarded route is the common case in the auditorium
  // (F5 on /teams): the guard redirects before the root has mounted its
  // subscriber, so the notice has to ride along here or nowhere.
  it('a 401 during hydration sends the user to /login with the expired notice', async () => {
    setSession(participant, 'tok-1')
    mockedGetMe.mockResolvedValue({
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
      // biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stub
    } as any)
    await settle(retryHydration())

    // No `settle` here: the store already settled, so `ensureHydrated()`
    // returns its cached promise and no timer stands between the call and the
    // redirect it throws.
    let caught: unknown
    try {
      await requireSession(ctx)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({
      options: { to: '/login', search: { redirect: '/organizer', notice: 'expired' } },
    })
  })

  it('a visitor who never had a session gets no expired notice', async () => {
    clearSession('manual')

    // No `settle` here: the store already settled, so `ensureHydrated()`
    // returns its cached promise and no timer stands between the call and the
    // redirect it throws.
    let caught: unknown
    try {
      await requireSession(ctx)
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({ options: { to: '/login', search: { redirect: '/organizer' } } })
    expect((caught as { options: { search: Record<string, unknown> } }).options.search.notice).toBe(
      undefined,
    )
  })

  it('requireSession resolves instead of redirecting to /login', async () => {
    await enterErrorState()

    await expect(settle(requireSession(ctx))).resolves.toBeUndefined()
  })

  it('requireAuth resolves instead of redirecting', async () => {
    await enterErrorState()

    await expect(settle(requireAuth(ctx))).resolves.toBeUndefined()
  })

  it('requireRole resolves instead of claiming the wrong role', async () => {
    await enterErrorState()

    await expect(settle(requireRole('organizer')(ctx))).resolves.toBeUndefined()
  })

  // Entering a guarded route while stuck in 'error' is itself a chance to
  // recover: the guard's own `ensureHydrated()` tries `/me` again, and a back
  // that came back up mid-navigation lets the user straight through.
  it('a guard re-attempts hydration and lets a recovered session through', async () => {
    await enterErrorState()
    mockedGetMe.mockReset()
    mockedGetMe.mockResolvedValue({
      status: 200,
      json: async () => participant,
      // biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stub
    } as any)

    await expect(settle(requireSession(ctx))).resolves.toBeUndefined()
    expect(getState().status).toBe('authenticated')
  })
})
