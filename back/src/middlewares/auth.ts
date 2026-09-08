import { guard, jwtAuth, requireRole } from '@katajs-framework/core/jwt'

import { JWT_SECRET } from '../config'
import type { AppRegistry } from '../context'
import { defineMiddleware } from '../context'
import { UserClaimsSchema } from '../modules/users/users.schema'
import { findUserById } from '../modules/users/users.service'

// Authenticates via JWT and fills the `currentUser` scoped slot by looking the
// subject up in the db (not trusting stale claims on a since-deleted user).
// Returning undefined renders kata's standard 401 "No such user".
export const requireUser = defineMiddleware({
  provides: ['currentUser'] as const,
  handler: jwtAuth({
    secret: JWT_SECRET,
    claims: UserClaimsSchema,
    resolve: async (claims, c) => {
      const user = await findUserById(c.get('db'), claims.sub)
      if (!user) return undefined
      const { passwordHash: _passwordHash, ...publicUser } = user
      return publicUser
    },
  }),
})

// Blocks every authenticated route while the account is on a temporary
// password handed out by an organizer (#143), until it is changed. Goes in
// `use:` right after `requireUser` on *every* authenticated route — the two
// deliberate exceptions are `GET /me` (the front reads the flag from it) and
// `POST /auth/change-password` (the way out). The rule is enforced by the
// guardrail test in src/auth-guards.test.ts, which owns that allowlist; the
// reasoning for per-route middleware over a wrapped `requireUser` is in
// ADR-0004.
//
// It also settles what to do about the target's existing JWT: the token stays
// valid, but every route it can reach now answers 403, so the only thing it
// can still do is change the password.
export const requirePasswordUpToDate = defineMiddleware({
  provides: [] as const,
  handler: guard<AppRegistry>({
    authorize: (user) => !user.mustChangePassword,
    code: 'password_change_required',
    message: 'Change your password before using the API',
  }),
})

// Authorizes an already-authenticated request (requireUser must run first in
// `use:`). Reads the `currentUser` slot; doesn't fill one, so `provides` is empty.
export const requireOrganizer = defineMiddleware({
  provides: [] as const,
  handler: requireRole<AppRegistry>('organizer'),
})
