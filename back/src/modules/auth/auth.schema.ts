import { z } from 'zod'

// Ceilings (#287). A password that is *set* is capped where it is chosen, so
// no account can ever hold one longer than this. A password that is only
// *verified* (login, currentPassword, the organizer step-up) gets a looser
// cap: it must still accept whatever an existing account holds, and the point
// there is only to bound the argon2 input — the app-wide bodyLimit already
// keeps the request itself small.
export const PASSWORD_MAX_LENGTH = 128
export const VERIFIED_PASSWORD_MAX_LENGTH = 1024

export const SignupBodySchema = z.object({
  // Required here and nowhere else (#122): the column is nullable so accounts
  // that predate it keep working, so this schema is what makes the name
  // mandatory for everyone signing up from now on. No charset rule — accents,
  // spaces and compound names are ordinary. `.trim()` runs before the length
  // checks, so "  A  " is a 1-character name, and what reaches the db is the
  // trimmed value.
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(PASSWORD_MAX_LENGTH),
  code: z.string().min(1),
})

// Login re-checks a real hash, not password strength, so no `.min(8)` here —
// that's a signup-time rule.
export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(VERIFIED_PASSWORD_MAX_LENGTH),
})

export const LoginResponseSchema = z.object({
  token: z.string(),
})

// `currentPassword` has no `.min(8)` for the same reason login's doesn't: it's
// checked against a real hash, and one of the passwords it has to accept is
// the 12-character temporary one an organizer just dictated (#143).
export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(VERIFIED_PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(8).max(PASSWORD_MAX_LENGTH),
})

export type SignupBody = z.infer<typeof SignupBodySchema>
export type LoginBody = z.infer<typeof LoginBodySchema>
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>
