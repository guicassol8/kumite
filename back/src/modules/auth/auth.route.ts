import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { PublicUserSchema } from '../users/users.schema'

import { LoginBodySchema, LoginResponseSchema, SignupBodySchema } from './auth.schema'
import { login, signup } from './auth.service'

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
