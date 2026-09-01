import { jwtAuth, requireRole } from '@katajs-framework/core/jwt'

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

// Authorizes an already-authenticated request (requireUser must run first in
// `use:`). Reads the `currentUser` slot; doesn't fill one, so `provides` is empty.
export const requireOrganizer = defineMiddleware({
  provides: [] as const,
  handler: requireRole<AppRegistry>('organizer'),
})
