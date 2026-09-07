import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'

import { CompletePasswordResetBodySchema, NoContentSchema } from './password-reset.schema'
import { completePasswordReset } from './password-reset.service'

// Public — no `use:` — like login/signup: the user identifies by email, not
// a session, since the reset was triggered by an organizer, not by them.
export const completePasswordResetRoute = defineRoute({
  method: 'POST',
  path: '/auth/complete-password-reset',
  input: { body: CompletePasswordResetBodySchema },
  output: { 204: NoContentSchema, 400: ErrorBodySchema },
  handler: async (c) => {
    const result = await completePasswordReset(c.get('db'), c.input.body)
    if (result.ok) return c.json(undefined, 204)

    return c.error('invalid_otp', 'Invalid or expired code', { status: 400 })
  },
})
