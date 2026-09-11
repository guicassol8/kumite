import { redirect } from '@tanstack/react-router'

import { ensureHydrated, getState, type SessionUser } from './session'

type GuardContext = { location: { href: string } }

// Authentication only. Split out of `requireAuth` for /change-password, which
// needs a session but cannot demand an up-to-date password — it is the screen
// that fixes that, so guarding it with `requireAuth` would loop it into itself.
export async function requireSession({ location }: GuardContext): Promise<void> {
  await ensureHydrated()
  // Hydration gave up without ever learning whether this user is signed in
  // (#179). Bouncing them to /login would be a lie — the token may well be
  // good — so the guard steps aside and the root's retry card takes the
  // screen instead.
  const { status, reason } = getState()
  if (status === 'error') return
  if (status !== 'authenticated') {
    // On a cold deep link the redirect happens here, before the root has even
    // mounted its subscriber — so this is the only place that can explain a
    // token that turned out to be dead (#179). `reason` is 'expired' exactly
    // when a session was dropped, never when the visitor simply never had one.
    throw redirect({
      to: '/login',
      search:
        reason === 'expired'
          ? { redirect: location.href, notice: 'expired' }
          : { redirect: location.href },
    })
  }
}

// Authentication plus a password the organizer has not reset out from under
// the user (#143). The back answers 403 `password_change_required` on every
// route this side of /me anyway; redirecting here just means the user sees the
// screen that fixes it instead of a wall of failed requests.
export async function requireAuth(context: GuardContext): Promise<void> {
  await requireSession(context)
  if (getState().status === 'error') return
  if (getState().user?.mustChangePassword) {
    throw redirect({ to: '/change-password' })
  }
}

export function requireRole(role: SessionUser['role']) {
  return async (context: GuardContext): Promise<void> => {
    await requireAuth(context)
    // Same reasoning as requireSession: with no user loaded, a role check can
    // only fail, and "you are not an organizer" is the wrong thing to tell
    // someone whose session simply could not be fetched (#179).
    if (getState().status === 'error') return
    if (getState().user?.role !== role) {
      throw redirect({ to: '/', search: { notice: 'forbidden-organizer' } })
    }
  }
}
