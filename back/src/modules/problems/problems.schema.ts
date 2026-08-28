import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'
import { LocaleSchema } from '../../lib/locale'

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
  id: z.string(),
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

export type CreateProblemBody = z.infer<typeof CreateProblemBodySchema>
export type ProblemIdParams = z.infer<typeof ProblemIdParamsSchema>
export type TranslationInput = z.infer<typeof TranslationInputSchema>
export type UpdateProblemBody = z.infer<typeof UpdateProblemBodySchema>
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>
export type ProblemSummary = z.infer<typeof ProblemSummarySchema>
