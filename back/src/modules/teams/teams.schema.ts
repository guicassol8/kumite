import { z } from 'zod'

import { UniversitySchema } from '../users/users.schema'

// Mirrors the `teams` drizzle table (db/schema.ts).
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  // coerce, not date(): kata re-validates the output after JSON serialization,
  // where a Date has already become an ISO string.
  firstSubmittedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Team = z.infer<typeof TeamSchema>
export type NewTeam = Omit<Team, 'id' | 'createdAt' | 'updatedAt'>

// Mirrors the `team_members` drizzle table (db/schema.ts).
export const TeamMemberSchema = z.object({
  userId: z.string(),
  teamId: z.string(),
  joinedAt: z.coerce.date(),
})

export type TeamMember = z.infer<typeof TeamMemberSchema>

// Mirrors the `event_config` drizzle table (db/schema.ts).
export const EventConfigSchema = z.object({
  id: z.number(),
  mixingLocked: z.boolean(),
  maxTeamSize: z.number().int().positive(),
  updatedAt: z.coerce.date(),
})

export type EventConfig = z.infer<typeof EventConfigSchema>

// --- Team lifecycle DTOs (#31) ---

export const CreateTeamBodySchema = z.object({
  name: z.string().min(1).max(40),
})

export const JoinTeamParamsSchema = z.object({
  id: z.string(),
})

export const TeamMemberViewSchema = z.object({
  university: UniversitySchema,
})

export const TeamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(TeamMemberViewSchema),
  maxTeamSize: z.number().int().positive(),
  slotsAvailable: z.number().int(),
})

export const TeamSummaryListSchema = z.array(TeamSummarySchema)

export const NoContentSchema = z.void()

export type CreateTeamBody = z.infer<typeof CreateTeamBodySchema>
export type JoinTeamParams = z.infer<typeof JoinTeamParamsSchema>
export type TeamMemberView = z.infer<typeof TeamMemberViewSchema>
export type TeamSummary = z.infer<typeof TeamSummarySchema>
