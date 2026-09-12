import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { clientIp } from '../../lib/client-ip'

import {
  CompletePasswordResetBodySchema,
  NoContentSchema,
  RequestPasswordResetBodySchema,
} from './password-reset.schema'
import { completePasswordReset, requestPasswordReset } from './password-reset.service'

// Public — no `use:` — like login/signup: whoever forgot their password has
// no session to authenticate with. Always 204, whether or not the email is
// registered, so the route never tells an anonymous caller who has an account.
export const requestPasswordResetRoute = defineRoute({
  method: 'POST',
  path: '/auth/request-password-reset',
  input: { body: RequestPasswordResetBodySchema },
  output: { 204: NoContentSchema },
  handler: async (c) => {
    await requestPasswordReset(
      c.get('db'),
      c.input.body.email,
      clientIp(c.raw),
      undefined,
      c.input.body.locale,
    )
    return c.json(undefined, 204)
  },
})

// Public for the same reason — the user identifies by email plus the code.
export const completePasswordResetRoute = defineRoute({
  method: 'POST',
  path: '/auth/complete-password-reset',
  input: { body: CompletePasswordResetBodySchema },
  output: { 204: NoContentSchema, 400: ErrorBodySchema },
  handler: async (c) => {
    const result = await completePasswordReset(c.get('db'), c.input.body, clientIp(c.raw))
    if (result.ok) return c.json(undefined, 204)

    return c.error('invalid_otp', 'Invalid or expired code', { status: 400 })
  },
})
