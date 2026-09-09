import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireUser } from '../../middlewares/auth'
import { NoContentSchema } from '../password-reset/password-reset.schema'
import { PublicUserSchema } from '../users/users.schema'

import {
  ChangePasswordBodySchema,
  LoginBodySchema,
  LoginResponseSchema,
  SignupBodySchema,
} from './auth.schema'
import { changePassword, login, signup } from './auth.service'

export const signupRoute = defineRoute({
  method: 'POST',
  path: '/auth/signup',
  input: { body: SignupBodySchema },
  output: { 201: PublicUserSchema, 400: ErrorBodySchema },
  handler: async (c) => {
    const result = await signup(c.get('db'), c.input.body)
    if (result.ok) return c.json(result.user, 201)

    switch (result.error) {
      case 'invalid_event_code':
        return c.error('invalid_event_code', 'Invalid event code', { status: 400 })
      case 'invalid_email_domain':
        return c.error(
          'invalid_email_domain',
          `Email must end with one of: ${result.allowedSuffixes.join(', ')}`,
          { status: 400 },
        )
      case 'signup_failed':
        return c.error('signup_failed', 'Could not complete signup', { status: 400 })
    }
  },
})

export const loginRoute = defineRoute({
  method: 'POST',
  path: '/auth/login',
  input: { body: LoginBodySchema },
  output: { 200: LoginResponseSchema, 401: ErrorBodySchema },
  handler: async (c) => {
    const result = await login(c.get('db'), c.input.body)
    if (result.ok) return c.json({ token: result.token }, 200)

    return c.error('invalid_credentials', 'Invalid email or password', { status: 401 })
  },
})

// The other route deliberately outside `requirePasswordUpToDate` (ADR-0004):
// it is the only way out of the forced-change state, so guarding it would
// leave a reset account with nothing it is allowed to do. `requireUser` alone
// still means you can only ever change your own password.
export const changePasswordRoute = defineRoute({
  method: 'POST',
  path: '/auth/change-password',
  use: [requireUser],
  input: { body: ChangePasswordBodySchema },
  output: { 204: NoContentSchema, 401: ErrorBodySchema },
  handler: async (c) => {
    const result = await changePassword(c.get('db'), c.get('currentUser').id, c.input.body)
    if (result.ok) return c.json(undefined, 204)

    return c.error('invalid_credentials', 'Invalid current password', { status: 401 })
  },
})
