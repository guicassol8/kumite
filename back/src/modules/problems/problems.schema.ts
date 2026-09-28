import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'
import { LocaleSchema } from '../../lib/locale'
import { UuidSchema } from '../../lib/uuid'

import { BestSubmissionSchema } from '../submissions/submissions.schema'

// Mirrors the `problems`/`problem_translations` drizzle tables (db/schema.ts).
export const DifficultySchema = z.enum(['easy', 'medium', 'hard'])
export const ProblemStatusSchema = z.enum(['draft', 'published', 'archived'])
// Where a problem lives (#209): 'round' is the competition; 'practice' is read
// outside any round, never enters one and is never submitted.
export const ProblemVisibilitySchema = z.enum(['round', 'practice'])

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
  visibility: ProblemVisibilitySchema,
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
export type ProblemVisibility = z.infer<typeof ProblemVisibilitySchema>
export type TestCase = z.infer<typeof TestCaseSchema>
export type Problem = z.infer<typeof ProblemSchema>
export type ProblemTranslation = z.infer<typeof ProblemTranslationSchema>

// --- Organizer CRUD DTOs (#10) ---

/**
 * Product ceiling on a problem's score (#187). The hard floor is the column
 * itself — `points` is a Postgres `integer` (db/schema.ts), so anything past
 * 2_147_483_647 used to pass zod and blow up in the INSERT as a 500 with no
 * `issues`, leaving the organizer's form with nothing to point at. This number
 * is far below that on purpose: it is what the event actually scores with, and
 * it reads well inside the message the form shows.
 *
 * Only the *request* schemas below take it. `ProblemSchema`/`ProblemDetailSchema`
 * describe rows being read back, and kata re-validates handler output against
 * them — capping those would make any legacy row above the ceiling unserializable.
 *
 * Mirrored in the front as `POINTS_MAX` (front/src/lib/field-limits.ts); tests
 * on both sides pin the literal, so a drift breaks the suite.
 */
export const PROBLEM_POINTS_MAX = 10_000

export const CreateProblemBodySchema = z.object({
  difficulty: DifficultySchema,
  points: z.number().int().positive().max(PROBLEM_POINTS_MAX).optional(),
  // Absent means 'round' (#209): the competition stays the default audience.
  visibility: ProblemVisibilitySchema.optional(),
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
    points: z.number().int().positive().max(PROBLEM_POINTS_MAX).optional(),
    testCases: z.array(TestCaseSchema).optional(),
    translations: z.array(TranslationInputSchema).optional(),
    visibility: ProblemVisibilitySchema.optional(),
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
  visibility: ProblemVisibilitySchema,
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
  visibility: ProblemVisibilitySchema,
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

// The step-by-step demo of a seeded practice problem (#212). The front types its
// map of demo scripts by this enum through AppType, so a key added here without
// a script there fails `pnpm -r typecheck`.
export const PracticeDemoKeySchema = z.enum(['devolva-entrada', 'e-par', 'soma-lista'])

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
  visibility: ProblemVisibilitySchema,
  // Round access (#37): null/'closed' when the problem's round has ended (read
  // only, no more submissions); populated when it's the currently open round.
  // A practice problem (#209) has no round at all: null/'none'.
  roundId: z.string().nullable(),
  roundStatus: z.enum(['open', 'closed', 'none']),
  // The team's best submission in this round, open or closed (#206); null
  // when the team never submitted it or the caller has no team.
  bestSubmission: BestSubmissionSchema.nullable(),
  // Which demo the practice screen can replay (#212): set only on a practice
  // problem whose pt title is a seeded one (db/practice-problems.ts), null on
  // a round problem and on any practice problem the organizer wrote.
  demoKey: PracticeDemoKeySchema.nullable(),
})

export type PracticeDemoKey = z.infer<typeof PracticeDemoKeySchema>
export type ParticipantProblemParams = z.infer<typeof ParticipantProblemParamsSchema>
export type ParticipantProblemQuery = z.infer<typeof ParticipantProblemQuerySchema>
export type ExampleCase = z.infer<typeof ExampleCaseSchema>
export type ParticipantProblem = z.infer<typeof ParticipantProblemSchema>

// --- Practice catalog DTOs (#209) ---

export const PracticeProblemListQuerySchema = z.object({
  locale: LocaleSchema.default('pt'),
})

// A listing, not a read: no statement, no examples, and never a test case.
export const PracticeProblemSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  // The locale actually served — a missing translation falls back to pt.
  locale: LocaleSchema,
})

export const PracticeProblemListSchema = z.array(PracticeProblemSummarySchema)

export type PracticeProblemListQuery = z.infer<typeof PracticeProblemListQuerySchema>
export type PracticeProblemSummary = z.infer<typeof PracticeProblemSummarySchema>
