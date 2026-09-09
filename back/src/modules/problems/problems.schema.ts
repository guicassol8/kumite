import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'
import { LocaleSchema } from '../../lib/locale'
import { UuidSchema } from '../../lib/uuid'

import { BestSubmissionSchema } from '../submissions/submissions.schema'

// Mirrors the `problems`/`problem_translations` drizzle tables (db/schema.ts).
export const DifficultySchema = z.enum(['easy', 'medium', 'hard'])
export const ProblemStatusSchema = z.enum(['draft', 'published', 'archived'])

export const TestCaseSchema = z.object({
  input: JsonValueSchema,
  expected: JsonValueSchema,
  hidden: z.boolean(),
})

export const ProblemSchema = z.object({
  id: z.string(),
  points: z.number().int(),
  difficulty: DifficultySchema,
  status: ProblemStatusSchema,
  testCases: z.array(TestCaseSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const ProblemTranslationSchema = z.object({
  problemId: z.string(),
  locale: LocaleSchema,
  title: z.string(),
  statementMd: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Difficulty = z.infer<typeof DifficultySchema>
export type ProblemStatus = z.infer<typeof ProblemStatusSchema>
export type TestCase = z.infer<typeof TestCaseSchema>
export type Problem = z.infer<typeof ProblemSchema>
export type ProblemTranslation = z.infer<typeof ProblemTranslationSchema>

// --- Organizer CRUD DTOs (#10) ---

export const CreateProblemBodySchema = z.object({
  difficulty: DifficultySchema,
  points: z.number().int().positive().optional(),
})

export const ProblemIdParamsSchema = z.object({
  id: UuidSchema,
})

export const TranslationInputSchema = z.object({
  locale: LocaleSchema,
  title: z.string().min(1),
  statementMd: z.string().min(1),
})

export const UpdateProblemBodySchema = z
  .object({
    difficulty: DifficultySchema.optional(),
    points: z.number().int().positive().optional(),
    testCases: z.array(TestCaseSchema).optional(),
    translations: z.array(TranslationInputSchema).optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.translations) return
    const locales = body.translations.map((t) => t.locale)
    const duplicates = locales.filter((locale, index) => locales.indexOf(locale) !== index)
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate locale(s) in translations: ${[...new Set(duplicates)].join(', ')}`,
        path: ['translations'],
      })
    }
  })

// coerce, not date(): kata re-validates the output after JSON serialization,
// where a Date has already become an ISO string (see users.schema.ts).
export const ProblemDetailSchema = z.object({
  id: z.string(),
  points: z.number().int(),
  difficulty: DifficultySchema,
  status: ProblemStatusSchema,
  testCases: z.array(TestCaseSchema),
  translations: z.array(
    z.object({ locale: LocaleSchema, title: z.string(), statementMd: z.string() }),
  ),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const ProblemSummarySchema = z.object({
  id: z.string(),
  points: z.number().int(),
  difficulty: DifficultySchema,
  status: ProblemStatusSchema,
  testCaseCount: z.number().int(),
  translations: z.array(z.object({ locale: LocaleSchema, title: z.string() })),
})

export const ProblemSummaryListSchema = z.array(ProblemSummarySchema)

export type CreateProblemBody = z.infer<typeof CreateProblemBodySchema>
export type ProblemIdParams = z.infer<typeof ProblemIdParamsSchema>
export type TranslationInput = z.infer<typeof TranslationInputSchema>
export type UpdateProblemBody = z.infer<typeof UpdateProblemBodySchema>
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>
export type ProblemSummary = z.infer<typeof ProblemSummarySchema>

// --- Participant read DTOs (#11) ---

export const ParticipantProblemParamsSchema = z.object({
  id: UuidSchema,
})

// Optional query param: no `?locale=` means pt. An unsupported value fails
// input validation (kata's 422 envelope) with the supported ones in the message.
export const ParticipantProblemQuerySchema = z.object({
  locale: LocaleSchema.default('pt'),
})

// Deliberately without `hidden`: this is what a participant is allowed to see,
// and kata re-validates the handler's output against it.
export const ExampleCaseSchema = z.object({
  input: JsonValueSchema,
  expected: JsonValueSchema,
})

export const ParticipantProblemSchema = z.object({
  id: z.string(),
  points: z.number().int(),
  difficulty: DifficultySchema,
  // The locale actually served, which is not always the one requested (a
  // missing translation falls back to pt).
  locale: LocaleSchema,
  title: z.string(),
  statementMd: z.string(),
  examples: z.array(ExampleCaseSchema),
  // Round access (#37): null/'closed' when the problem's round has ended (read
  // only, no more submissions); populated when it's the currently open round.
  roundId: z.string().nullable(),
  roundStatus: z.enum(['open', 'closed']),
  // The team's best submission once the round is closed, null if it never
  // submitted; always null while the round is open (no query performed then).
  bestSubmission: BestSubmissionSchema.nullable(),
})

export type ParticipantProblemParams = z.infer<typeof ParticipantProblemParamsSchema>
export type ParticipantProblemQuery = z.infer<typeof ParticipantProblemQuerySchema>
export type ExampleCase = z.infer<typeof ExampleCaseSchema>
export type ParticipantProblem = z.infer<typeof ParticipantProblemSchema>
