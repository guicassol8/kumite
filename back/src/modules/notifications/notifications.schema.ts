import { z } from 'zod'

export const PasswordResetNoticeSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
})

export type PasswordResetNotice = z.infer<typeof PasswordResetNoticeSchema>
