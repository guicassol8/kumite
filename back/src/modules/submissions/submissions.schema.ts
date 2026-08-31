import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'

// Mirrors the `submissions` drizzle table (db/schema.ts).
export const SubmissionCaseStatusSchema = z.enum(['passed', 'failed', 'timeout', 'error'])

export const SubmissionCaseResultSchema = z.object({
  index: z.number().int().nonnegative(),
  status: SubmissionCaseStatusSchema,
})

// coerce, not date(): kata re-validates the output after JSON serialization,
// where a Date has already become an ISO string (see problems.schema.ts).
export const SubmissionSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  userId: z.string().nullable(),
  teamId: z.string().nullable(),
  workspace: JsonValueSchema,
  generatedCode: z.string(),
  caseResults: z.array(SubmissionCaseResultSchema),
  score: z.number().int(),
  attemptNumber: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// "Vale a melhor": the best score a team reached on a problem, when it got
// there (the tiebreaker) and how many attempts it took.
export const BestSubmissionSchema = z.object({
  score: z.number().int(),
  achievedAt: z.coerce.date(),
  attempts: z.number().int().positive(),
})

export type SubmissionCaseStatus = z.infer<typeof SubmissionCaseStatusSchema>
export type SubmissionCaseResult = z.infer<typeof SubmissionCaseResultSchema>
export type Submission = z.infer<typeof SubmissionSchema>
export type BestSubmission = z.infer<typeof BestSubmissionSchema>
