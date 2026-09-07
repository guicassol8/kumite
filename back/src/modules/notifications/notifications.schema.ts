import { z } from 'zod'

export const PasswordResetNoticeSchema = z.object({
  email: z.string().email(),
  temporaryPassword: z.string().min(1),
})

export type PasswordResetNotice = z.infer<typeof PasswordResetNoticeSchema>
