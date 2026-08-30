import { z } from 'zod'

// Mirrors the `teams` drizzle table (db/schema.ts).
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  // coerce, not date(): kata re-validates the output after JSON serialization,
  // where a Date has already become an ISO string.
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
