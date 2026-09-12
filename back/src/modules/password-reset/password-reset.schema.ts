import { z } from 'zod'

import { LocaleSchema } from '../../lib/locale'

export const RequestPasswordResetBodySchema = z.object({
  email: z.string().email(),
  // The i18next language active in the caller's UI at request time (#231):
  // there is no `locale` column on `users`, so the reset email speaks
  // whatever the requester was looking at when they asked. No default here —
  // the fallback to 'pt' lives only in renderPasswordResetEmail.
  locale: LocaleSchema.optional(),
})

export const CompletePasswordResetBodySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
})

export const NoContentSchema = z.void()

export type RequestPasswordResetBody = z.infer<typeof RequestPasswordResetBodySchema>
export type CompletePasswordResetBody = z.infer<typeof CompletePasswordResetBodySchema>
