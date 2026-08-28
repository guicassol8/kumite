import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'
import { LocaleSchema } from '../../lib/locale'

// Schema-only for now — no route/service until a future task consumes the
// problem catalog. Mirrors the `problems`/`problem_translations` drizzle
// tables (db/schema.ts).
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
