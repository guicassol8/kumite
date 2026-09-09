import { z } from 'zod'

import { LocaleSchema } from '../../lib/locale'
import { UuidSchema } from '../../lib/uuid'

import { DifficultySchema } from '../problems/problems.schema'

// Mirrors the `rounds` drizzle table (db/schema.ts).
export const RoundStatusSchema = z.enum(['draft', 'open', 'closed'])

export const RoundSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  status: RoundStatusSchema,
  durationMinutes: z.number().int().positive(),
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RoundStatus = z.infer<typeof RoundStatusSchema>
export type Round = z.infer<typeof RoundSchema>
export type NewRound = Pick<Round, 'name' | 'durationMinutes'>

// Mirrors the `round_problems` drizzle table (db/schema.ts).
export const RoundProblemSchema = z.object({
  roundId: z.string(),
  problemId: z.string(),
  position: z.number().int().nonnegative(),
})

export type RoundProblem = z.infer<typeof RoundProblemSchema>

// --- Organizer CRUD DTOs (#36) ---

function rejectDuplicateProblemIds(problemIds: string[], ctx: z.RefinementCtx) {
  const duplicates = problemIds.filter((id, index) => problemIds.indexOf(id) !== index)
  if (duplicates.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Duplicate problem id(s): ${[...new Set(duplicates)].join(', ')}`,
      path: ['problemIds'],
    })
  }
}

export const CreateRoundBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    durationMinutes: z.number().int().positive(),
    problemIds: z.array(UuidSchema),
  })
  .superRefine((body, ctx) => rejectDuplicateProblemIds(body.problemIds, ctx))

export const UpdateRoundBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    durationMinutes: z.number().int().positive().optional(),
    problemIds: z.array(UuidSchema).optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.problemIds) return
    rejectDuplicateProblemIds(body.problemIds, ctx)
  })

export const RoundIdParamsSchema = z.object({
  id: UuidSchema,
})

export const ExtendRoundBodySchema = z.object({
  minutes: z.number().int().positive(),
})

export const RoundProblemDetailSchema = z.object({
  problemId: z.string(),
  position: z.number().int().nonnegative(),
})

// coerce, not date(): kata re-validates the output after JSON serialization,
// where a Date has already become an ISO string (see problems.schema.ts).
export const RoundDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: RoundStatusSchema,
  durationMinutes: z.number().int().positive(),
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  problems: z.array(RoundProblemDetailSchema),
})

export const RoundSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: RoundStatusSchema,
  durationMinutes: z.number().int().positive(),
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  problemCount: z.number().int().nonnegative(),
})

export const RoundSummaryListSchema = z.array(RoundSummarySchema)

export type CreateRoundBody = z.infer<typeof CreateRoundBodySchema>
export type UpdateRoundBody = z.infer<typeof UpdateRoundBodySchema>
export type RoundIdParams = z.infer<typeof RoundIdParamsSchema>
export type ExtendRoundBody = z.infer<typeof ExtendRoundBodySchema>
export type RoundProblemDetail = z.infer<typeof RoundProblemDetailSchema>
export type RoundDetail = z.infer<typeof RoundDetailSchema>
export type RoundSummary = z.infer<typeof RoundSummarySchema>

// --- Participant round-detail DTOs (#39) ---

// Narrower than RoundStatusSchema: a draft round is never visible to a
// participant (same "never announces itself" rule as listParticipantRounds).
export const ParticipantRoundStatusSchema = z.enum(['open', 'closed'])

// Optional query param: no `?locale=` means pt, same shape as
// problems.schema.ts's ParticipantProblemQuerySchema.
export const ParticipantRoundQuerySchema = z.object({
  locale: LocaleSchema.default('pt'),
})

export const ParticipantRoundProblemSchema = z.object({
  problemId: z.string(),
  position: z.number().int().nonnegative(),
  title: z.string(),
  difficulty: DifficultySchema,
  points: z.number().int(),
  // The team's best score on this problem. Null while the round is open (the
  // participant doesn't need it yet, same rule as getPublishedProblem) and
  // once the round is closed, null only when the team never submitted.
  bestScore: z.number().int().nullable(),
})

// coerce, not date(): kata re-validates the output after JSON serialization,
// where a Date has already become an ISO string (see RoundDetailSchema above).
export const ParticipantRoundDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: ParticipantRoundStatusSchema,
  durationMinutes: z.number().int().positive(),
  openedAt: z.coerce.date().nullable(),
  closesAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  problems: z.array(ParticipantRoundProblemSchema),
})

export type ParticipantRoundStatus = z.infer<typeof ParticipantRoundStatusSchema>
export type ParticipantRoundQuery = z.infer<typeof ParticipantRoundQuerySchema>
export type ParticipantRoundProblem = z.infer<typeof ParticipantRoundProblemSchema>
export type ParticipantRoundDetail = z.infer<typeof ParticipantRoundDetailSchema>
