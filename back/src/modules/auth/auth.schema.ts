import { z } from 'zod'

export const SignupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  code: z.string().min(1),
})

// Login re-checks a real hash, not password strength, so no `.min(8)` here —
// that's a signup-time rule.
export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const LoginResponseSchema = z.object({
  token: z.string(),
})

export type SignupBody = z.infer<typeof SignupBodySchema>
export type LoginBody = z.infer<typeof LoginBodySchema>
