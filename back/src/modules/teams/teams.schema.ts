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

// --- Team lifecycle DTOs (#31) ---

export const CreateTeamBodySchema = z.object({
  name: z.string().min(1).max(40),
})

export const JoinTeamParamsSchema = z.object({
  id: z.string(),
})

export const TeamMemberViewSchema = z.object({
  university: UniversitySchema,
  // Only filled in for the members of the viewer's own team — the public
  // listing stays anonymous (flag + university only).
  email: z.string().email().nullable(),
})

// Why the reason is computed server-side: the composition rules (max size,
// mixing lock) live in joinTeam, and duplicating them in the front would be
// two sources of truth for the same decision.
export const JoinBlockedReasonSchema = z.enum([
  'already_in_team',
  'team_full',
  'mixed_lock_violation',
])

export const TeamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(TeamMemberViewSchema),
  slotsAvailable: z.number().int(),
  frozen: z.boolean(),
  joinBlockedReason: JoinBlockedReasonSchema.nullable(),
})

// The listing is viewer-scoped: the same teams look different depending on
// who asks, so the event-wide facts ride along in the envelope.
export const TeamsListSchema = z.object({
  maxTeamSize: z.number().int().positive(),
  mixingLocked: z.boolean(),
  myTeamId: z.string().nullable(),
  teams: z.array(TeamSummarySchema),
})

export const NoContentSchema = z.void()

// --- Organizer moderation DTOs (#50) ---

export const RenameTeamParamsSchema = z.object({
  id: z.string(),
})

export const RenameTeamBodySchema = z.object({
  name: z.string().min(1).max(40),
})

export const MoveMemberParamsSchema = z.object({
  userId: z.string(),
})

export const MoveMemberBodySchema = z.object({
  teamId: z.string(),
})

export const RemoveMemberParamsSchema = z.object({
  userId: z.string(),
})

export const RemoveTeamParamsSchema = z.object({
  id: z.string(),
})

export type CreateTeamBody = z.infer<typeof CreateTeamBodySchema>
export type JoinTeamParams = z.infer<typeof JoinTeamParamsSchema>
export type TeamMemberView = z.infer<typeof TeamMemberViewSchema>
export type JoinBlockedReason = z.infer<typeof JoinBlockedReasonSchema>
export type TeamSummary = z.infer<typeof TeamSummarySchema>
export type TeamsList = z.infer<typeof TeamsListSchema>
export type RenameTeamParams = z.infer<typeof RenameTeamParamsSchema>
export type RenameTeamBody = z.infer<typeof RenameTeamBodySchema>
export type MoveMemberParams = z.infer<typeof MoveMemberParamsSchema>
export type MoveMemberBody = z.infer<typeof MoveMemberBodySchema>
export type RemoveMemberParams = z.infer<typeof RemoveMemberParamsSchema>
export type RemoveTeamParams = z.infer<typeof RemoveTeamParamsSchema>
