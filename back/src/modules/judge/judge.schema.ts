import { z } from 'zod'

import { JsonValueSchema } from '../../lib/json'

// Deliberately narrower than problems.schema.ts's TestCaseSchema — `hidden`
// is a problems-module presentation concern, not the judge's.
export const JudgeCaseSchema = z.object({
  input: JsonValueSchema,
  expected: JsonValueSchema,
})

export const JudgeOutcomeSchema = z.enum(['passed', 'failed', 'timeout', 'runtime_error'])

export const JudgeCaseResultSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('passed'), ms: z.number() }),
  z.object({
    outcome: z.literal('failed'),
    expected: JsonValueSchema,
    actual: JsonValueSchema,
    ms: z.number(),
  }),
  z.object({ outcome: z.literal('timeout'), ms: z.number() }),
  z.object({ outcome: z.literal('runtime_error'), detail: z.string(), ms: z.number() }),
])

export const JudgeConfigSchema = z.object({
  timeoutMs: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  concurrency: z.number().int().positive(),
})

export type JudgeCase = z.infer<typeof JudgeCaseSchema>
export type JudgeOutcome = z.infer<typeof JudgeOutcomeSchema>
export type JudgeCaseResult = z.infer<typeof JudgeCaseResultSchema>
export type JudgeConfig = z.infer<typeof JudgeConfigSchema>
