import { z } from 'zod'

import { UuidSchema } from '../../lib/uuid'

import { VERIFIED_PASSWORD_MAX_LENGTH } from '../auth/auth.schema'

// Mirrors the `users` drizzle table (db/schema.ts).
export const RoleSchema = z.enum(['participant', 'organizer'])
export const UniversitySchema = z.enum(['pucrs', 'merida'])

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  // Nullable for accounts predating #122 — the signup requirement is enforced
  // by SignupBodySchema, so every account created since carries one.
  name: z.string().nullable(),
  passwordHash: z.string(),
  role: RoleSchema,
  university: UniversitySchema,
  active: z.boolean(),
  // Rides along on PublicUserSchema, so GET /me carries it — the front reads
  // it off the session to force the change screen (#143).
  mustChangePassword: z.boolean(),
  // coerce, not date(): kata re-validates the output after JSON serialization,
  // where a Date has already become an ISO string.
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// The signup response shape — never leaks passwordHash over the wire.
export const PublicUserSchema = UserSchema.omit({ passwordHash: true })

// The claims a login JWT carries — the shape `signJwt` mints and `jwtAuth` verifies.
export const UserClaimsSchema = z.object({
  sub: z.string().min(1),
  role: RoleSchema,
  university: UniversitySchema,
})

export type Role = z.infer<typeof RoleSchema>
export type University = z.infer<typeof UniversitySchema>
export type User = z.infer<typeof UserSchema>
export type PublicUser = z.infer<typeof PublicUserSchema>
export type UserClaims = z.infer<typeof UserClaimsSchema>
// active is omitted: the db column defaults to true, and every user is
// created active — deactivation is a separate organizer action (T5/T7).
// mustChangePassword likewise defaults to false; only the organizer reset
// (#143) ever raises it.
export type NewUser = Omit<User, 'id' | 'active' | 'mustChangePassword' | 'createdAt' | 'updatedAt'>

// --- Organizer admin DTOs (#52) ---

export const ListUsersQuerySchema = z.object({
  // One box, matched against name OR email fragment (#122). Free text, so no
  // UuidSchema here — that convention (#152) is for ids, not for search.
  q: z.string().optional(),
  role: RoleSchema.optional(),
  university: UniversitySchema.optional(),
  // Strict on purpose: `?teamId=` with an empty value is a 422, not a filter
  // silently ignored. The front omits the key entirely when it means "all".
  teamId: UuidSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
})

export const TeamRefSchema = z.object({ id: z.string(), name: z.string() })

export const UserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: RoleSchema,
  university: UniversitySchema,
  active: z.boolean(),
  team: TeamRefSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const UserListSchema = z.object({
  items: z.array(UserSummarySchema),
  total: z.number().int(),
})

// UuidSchema, like ProblemIdParamsSchema: a malformed id can't match any row,
// so the 422 lands before the lookup instead of turning into a driver-level
// 500 — an unknown *well-formed* id still gets its 404 from the handler (#94).
export const UserIdParamsSchema = z.object({
  id: UuidSchema,
})

// Step-up body for the organizer reset (#143). No `.min(8)`: this is checked
// against a real hash, not for strength — same reasoning as LoginBodySchema.
export const ResetUserPasswordBodySchema = z.object({
  adminPassword: z.string().min(1).max(VERIFIED_PASSWORD_MAX_LENGTH),
})

// Only the password comes back. Nothing visible in the users table changed, and
// the front refetches the list anyway — echoing a UserSummary here would just
// be one more copy of the row for no reader.
export const ResetUserPasswordResponseSchema = z.object({
  temporaryPassword: z.string(),
})

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>
export type TeamRef = z.infer<typeof TeamRefSchema>
export type UserSummary = z.infer<typeof UserSummarySchema>
export type UserList = z.infer<typeof UserListSchema>
export type UserIdParams = z.infer<typeof UserIdParamsSchema>
export type ResetUserPasswordBody = z.infer<typeof ResetUserPasswordBodySchema>
