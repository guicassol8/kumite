import { jwtAuth } from '@katajs-framework/core/jwt'

import { JWT_SECRET } from '../config'
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
