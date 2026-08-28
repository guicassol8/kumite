import { z } from 'zod'

// Mirrors the `users` drizzle table (db/schema.ts).
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

// The signup response shape — never leaks passwordHash over the wire.
export const PublicUserSchema = UserSchema.omit({ passwordHash: true })

export type Role = z.infer<typeof RoleSchema>
export type University = z.infer<typeof UniversitySchema>
export type User = z.infer<typeof UserSchema>
export type PublicUser = z.infer<typeof PublicUserSchema>
export type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>
