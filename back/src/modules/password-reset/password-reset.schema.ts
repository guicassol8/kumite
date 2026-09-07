import { z } from 'zod'

export const CompletePasswordResetBodySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
})

export const NoContentSchema = z.void()

export type CompletePasswordResetBody = z.infer<typeof CompletePasswordResetBodySchema>
