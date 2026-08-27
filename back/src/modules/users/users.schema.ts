import { z } from 'zod'

// Schema-only for now — no route/service until #25 adds signup. Mirrors the
// `users` drizzle table (db/schema.ts).
export const RoleSchema = z.enum(['participant', 'organizer'])
export const UniversitySchema = z.enum(['pucrs', 'merida'])

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  role: RoleSchema,
  university: UniversitySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Role = z.infer<typeof RoleSchema>
export type University = z.infer<typeof UniversitySchema>
export type User = z.infer<typeof UserSchema>
