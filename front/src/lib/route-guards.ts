import { redirect } from '@tanstack/react-router'

import { ensureHydrated, getState, type SessionUser } from './session'

type GuardContext = { location: { href: string } }

// Authentication only. Split out of `requireAuth` for /change-password, which
// needs a session but cannot demand an up-to-date password — it is the screen
// that fixes that, so guarding it with `requireAuth` would loop it into itself.
export async function requireSession({ location }: GuardContext): Promise<void> {
  await ensureHydrated()
  if (getState().status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}

// Authentication plus a password the organizer has not reset out from under
// the user (#143). The back answers 403 `password_change_required` on every
// route this side of /me anyway; redirecting here just means the user sees the
// screen that fixes it instead of a wall of failed requests.
export async function requireAuth(context: GuardContext): Promise<void> {
  await requireSession(context)
  if (getState().user?.mustChangePassword) {
    throw redirect({ to: '/change-password' })
  }
}

export function requireRole(role: SessionUser['role']) {
  return async (context: GuardContext): Promise<void> => {
    await requireAuth(context)
    if (getState().user?.role !== role) {
      throw redirect({ to: '/', search: { notice: 'forbidden-organizer' } })
    }
  }
}
