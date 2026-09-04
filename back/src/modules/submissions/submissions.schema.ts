import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'
import { LocaleSchema } from '../../lib/locale'

import { WorkspaceSchema } from '../judge/judge.schema'

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
  userId: z.string(),
  teamId: z.string(),
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

// --- Submission pipeline DTOs (#21) ---

export const SubmitSolutionBodySchema = z.object({
  problemId: z.string().uuid(),
  // The round the participant believes is open and contains this problem
  // (#37) — a stale or mismatched id is rejected server-side, the client's
  // timer is never the authority.
  roundId: z.string().uuid(),
  // Reused from the judge module so the route validates exactly what codegen
  // will accept — never a second definition of the workspace shape.
  workspace: WorkspaceSchema,
  locale: LocaleSchema.optional(),
})

// The judge's own outcomes, verbatim: what the participant sees per case.
// The persisted `submission_case_status` differs (`error` for `runtime_error`)
// and submissions.service.ts owns that translation.
export const SubmissionCaseOutcomeSchema = z.enum(['passed', 'failed', 'timeout', 'runtime_error'])

// `hidden` discriminates what the participant is allowed to see: a hidden case
// carries no expected/actual/detail/ms at all — not even as an optional field.
export const SubmissionResultCaseSchema = z.discriminatedUnion('hidden', [
  z.object({
    hidden: z.literal(false),
    index: z.number().int().nonnegative(),
    outcome: SubmissionCaseOutcomeSchema,
    expected: JsonValueSchema,
    actual: JsonValueSchema.optional(), // only on 'failed'
    detail: z.string().optional(), // only on 'runtime_error'
    ms: z.number(),
  }),
  z.object({
    hidden: z.literal(true),
    index: z.number().int().nonnegative(),
    outcome: SubmissionCaseOutcomeSchema,
  }),
])

export const SubmissionResultSchema = z.object({
  submissionId: z.string(),
  attemptNumber: z.number().int().positive(),
  score: z.number().int(),
  maxScore: z.number().int(),
  cases: z.array(SubmissionResultCaseSchema),
})

export type SubmitSolutionBody = z.infer<typeof SubmitSolutionBodySchema>
export type SubmissionCaseOutcome = z.infer<typeof SubmissionCaseOutcomeSchema>
export type SubmissionResultCase = z.infer<typeof SubmissionResultCaseSchema>
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>
