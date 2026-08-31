import { redirect } from '@tanstack/react-router'

import { ensureHydrated, getState, type SessionUser } from './session'

type GuardContext = { location: { href: string } }

export async function requireAuth({ location }: GuardContext): Promise<void> {
  await ensureHydrated()
  if (getState().status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}

export function requireRole(role: SessionUser['role']) {
  return async ({ location }: GuardContext): Promise<void> => {
    await ensureHydrated()
    const state = getState()
    if (state.status !== 'authenticated') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (state.user?.role !== role) {
      throw redirect({ to: '/', search: { notice: 'forbidden-organizer' } })
    }
  }
}
