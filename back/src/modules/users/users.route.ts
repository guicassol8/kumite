import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireOrganizer, requireUser } from '../../middlewares/auth'

import {
  ListUsersQuerySchema,
  PublicUserSchema,
  UserIdParamsSchema,
  UserListSchema,
  UserSummarySchema,
} from './users.schema'
import { deactivateUser, demoteUser, listUsers, promoteUser, reactivateUser } from './users.service'

// 401 (requireUser) and 403 (requireOrganizer) are not declared on any route
// below: both short-circuit from middleware, which kata lets through without
// validating against `output` (framework ADR-0011) — same note as
// problems.route.ts / submissions.route.ts.

export const meRoute = defineRoute({
  method: 'GET',
  path: '/me',
  use: [requireUser],
  input: {},
  output: PublicUserSchema,
  handler: async (c) => c.get('currentUser'),
})

export const listUsersRoute = defineRoute({
  method: 'GET',
  path: '/organizer/users',
  use: [requireUser, requireOrganizer],
  input: { query: ListUsersQuerySchema },
  output: UserListSchema,
  handler: async (c) => listUsers(c.get('db'), c.input.query),
})

export const promoteUserRoute = defineRoute({
  method: 'POST',
  path: '/organizer/users/:id/promote',
  use: [requireUser, requireOrganizer],
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
  use: [requireUser, requireOrganizer],
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
  use: [requireUser, requireOrganizer],
  input: { params: UserIdParamsSchema },
  output: { 200: UserSummarySchema, 403: ErrorBodySchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await deactivateUser(c.get('db'), c.get('currentUser').id, c.input.params.id)
    if (result.ok) return c.json(result.user, 200)

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
  use: [requireUser, requireOrganizer],
  input: { params: UserIdParamsSchema },
  output: { 200: UserSummarySchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await reactivateUser(c.get('db'), c.input.params.id)
    if (result.ok) return c.json(result.user, 200)
    return c.error('not_found', 'User not found', { status: 404 })
  },
})
