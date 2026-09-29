import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { clientIp } from '../../lib/client-ip'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'
import { resetPasswordByOrganizer } from '../password-reset/password-reset.service'
import { publishUserDeactivated } from '../sse/sse.service'

import {
  ListUsersQuerySchema,
  PublicUserSchema,
  ResetUserPasswordBodySchema,
  ResetUserPasswordResponseSchema,
  UserIdParamsSchema,
  UserListSchema,
  UserSummarySchema,
} from './users.schema'
import {
  deactivateUser,
  demoteUser,
  listUsers,
  markOnboardingPrompted,
  promoteUser,
  reactivateUser,
} from './users.service'

// 401 (requireUser) and 403 (requireOrganizer / requirePasswordUpToDate) are
// not declared on any route below: all of them short-circuit from middleware,
// which kata lets through without validating against `output` (framework
// ADR-0011) — same note as problems.route.ts / submissions.route.ts. The 403
// declared on the reset route below is the handler's own, not the guards'.

// One of the two routes deliberately left out of `requirePasswordUpToDate`
// (ADR-0004): the front needs it to *discover* `mustChangePassword` in the
// first place, so blocking it would leave the client unable to tell why every
// other call is failing. It exposes nothing beyond the caller's own row.
export const meRoute = defineRoute({
  method: 'GET',
  path: '/me',
  use: [requireUser],
  input: {},
  output: PublicUserSchema,
  handler: async (c) => c.get('currentUser'),
})

// #213: records that the caller answered the onboarding-tour invite, accepted
// or declined — the front only asks while this is null, so the answer holds
// on every machine. Idempotent: a repeat returns the first timestamp. Not an
// escape hatch (ADR-0004): a user who must change their password is sent to
// that screen before the home ever shows the invite.
export const markOnboardingRoute = defineRoute({
  method: 'POST',
  path: '/me/onboarding',
  use: [requireUser, requirePasswordUpToDate],
  input: {},
  output: { 200: PublicUserSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const user = await markOnboardingPrompted(c.get('db'), c.get('currentUser').id)
    if (!user) return c.error('not_found', 'User not found', { status: 404 })
    const { passwordHash: _passwordHash, ...publicUser } = user
    return c.json(publicUser, 200)
  },
})

export const listUsersRoute = defineRoute({
  method: 'GET',
  path: '/organizer/users',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { query: ListUsersQuerySchema },
  output: UserListSchema,
  handler: async (c) => listUsers(c.get('db'), c.input.query),
})

export const promoteUserRoute = defineRoute({
  method: 'POST',
  path: '/organizer/users/:id/promote',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: UserIdParamsSchema },
  output: { 200: UserSummarySchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await promoteUser(c.get('db'), c.input.params.id)
    if (result.ok) return c.json(result.user, 200)
    return c.error('not_found', 'User not found', { status: 404 })
  },
})

export const demoteUserRoute = defineRoute({
  method: 'POST',
  path: '/organizer/users/:id/demote',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: UserIdParamsSchema },
  output: { 200: UserSummarySchema, 403: ErrorBodySchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await demoteUser(c.get('db'), c.get('currentUser').id, c.input.params.id)
    if (result.ok) return c.json(result.user, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'User not found', { status: 404 })
      case 'cannot_demote_self':
        return c.error('cannot_demote_self', 'You cannot demote yourself', { status: 403 })
    }
  },
})

export const deactivateUserRoute = defineRoute({
  method: 'POST',
  path: '/organizer/users/:id/deactivate',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: UserIdParamsSchema },
  output: { 200: UserSummarySchema, 403: ErrorBodySchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await deactivateUser(c.get('db'), c.get('currentUser').id, c.input.params.id)
    if (result.ok) {
      // #274: closes this account's live `/sse` stream, if it has one, without
      // every connection polling `findUserById` once a second to notice.
      // Published here rather than from the service because services stay pure
      // (AGENTS.md) and the bus is the route's to reach for — same as
      // rounds.route.ts. Only on the happy path: a refused deactivation
      // changed no row and must close nothing.
      publishUserDeactivated(c.get('sseBus'), result.user.id)
      return c.json(result.user, 200)
    }

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'User not found', { status: 404 })
      case 'cannot_deactivate_self':
        return c.error('cannot_deactivate_self', 'You cannot deactivate yourself', { status: 403 })
    }
  },
})

export const reactivateUserRoute = defineRoute({
  method: 'POST',
  path: '/organizer/users/:id/reactivate',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: UserIdParamsSchema },
  output: { 200: UserSummarySchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await reactivateUser(c.get('db'), c.input.params.id)
    if (result.ok) return c.json(result.user, 200)
    return c.error('not_found', 'User not found', { status: 404 })
  },
})

// The on-site valve (#143): a participant at the desk who cannot reach their
// inbox. Guarded by step-up — the organizer re-types their own password — so a
// hijacked session is not enough to take over accounts. Both a wrong password
// and an exhausted step-up ceiling answer the same 403, on purpose: which of
// the two it was is exactly what a brute-forcer would like to know.
export const resetUserPasswordRoute = defineRoute({
  method: 'POST',
  path: '/organizer/users/:id/reset-password',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: UserIdParamsSchema, body: ResetUserPasswordBodySchema },
  output: {
    200: ResetUserPasswordResponseSchema,
    403: ErrorBodySchema,
    404: ErrorBodySchema,
  },
  handler: async (c) => {
    const result = await resetPasswordByOrganizer(c.get('db'), {
      organizerId: c.get('currentUser').id,
      targetId: c.input.params.id,
      adminPassword: c.input.body.adminPassword,
      ip: clientIp(c.raw),
    })
    if (result.ok) return c.json({ temporaryPassword: result.temporaryPassword }, 200)

    switch (result.error) {
      case 'invalid_admin_password':
        return c.error('invalid_admin_password', 'Invalid organizer password', { status: 403 })
      case 'target_not_participant':
        return c.error('cannot_reset_organizer', 'Only participants can be reset', { status: 403 })
      case 'not_found':
        return c.error('not_found', 'User not found', { status: 404 })
    }
  },
})
