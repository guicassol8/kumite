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
  active: z.boolean(),
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
export type NewUser = Omit<User, 'id' | 'active' | 'createdAt' | 'updatedAt'>

// --- Organizer admin DTOs (#52) ---

export const ListUsersQuerySchema = z.object({
  // Email-fragment search only — see the plan's scope note on #52 for why
  // name search isn't here (split into a separate discovered-work issue, #122).
  q: z.string().optional(),
  role: RoleSchema.optional(),
  university: UniversitySchema.optional(),
  teamId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
})

export const TeamRefSchema = z.object({ id: z.string(), name: z.string() })

export const UserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
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

// Plain string, like ProblemIdParamsSchema — not .uuid(), so an unknown id
// still 404s instead of failing input validation.
export const UserIdParamsSchema = z.object({
  id: z.string(),
})

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>
export type TeamRef = z.infer<typeof TeamRefSchema>
export type UserSummary = z.infer<typeof UserSummarySchema>
export type UserList = z.infer<typeof UserListSchema>
export type UserIdParams = z.infer<typeof UserIdParamsSchema>
