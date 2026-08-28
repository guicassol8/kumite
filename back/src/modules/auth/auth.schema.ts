import { z } from 'zod'

export const SignupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  code: z.string().min(1),
})

export type SignupBody = z.infer<typeof SignupBodySchema>
