import { isRedirect } from '@tanstack/react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { requireAuth, requireRole } from './route-guards'
import { clearSession, type SessionUser, setSession } from './session'

const participant: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
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
