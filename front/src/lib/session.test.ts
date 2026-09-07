import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  api: { me: { $get: vi.fn() } },
}))

import { api } from './api'
import type { SessionUser } from './session'

const mockedGetMe = vi.mocked(api.me.$get)

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
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
})
