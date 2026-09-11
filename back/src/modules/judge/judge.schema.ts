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

/**
 * A serialized Blockly workspace, straight from the editor.
 *
 * Deliberately permissive: it only proves "this is a JSON object". The real
 * shape is Blockly's serialization format, owned by the deserializer inside
 * `generateSolution` — a second definition in zod would drift away from it,
 * and every rejection this schema would add is already one of the codegen
 * refusals below.
 */
export const WorkspaceSchema = z.record(z.string(), JsonValueSchema)

/** The ways codegen can refuse a workspace. Snake_case: it is also the
 * `c.error` code the route (#21) hands to the client. */
export const CodegenErrorCodeSchema = z.enum([
  'malformed_workspace',
  'missing_root',
  'duplicate_root',
  'block_not_allowed',
  'disabled_block',
])

export const JudgeConfigSchema = z.object({
  timeoutMs: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  concurrency: z.number().int().positive(),
})

export type Workspace = z.infer<typeof WorkspaceSchema>
export type CodegenErrorCode = z.infer<typeof CodegenErrorCodeSchema>

/** Result of `generateJudgeSource`. On failure, `message` is already
 * localized (it comes from `@kumite/blocks`) and `blockType` names the
 * offending block when the refusal is about one. */
export type GenerateSourceResult =
  | { ok: true; source: string }
  | { ok: false; error: CodegenErrorCode; message: string; blockType?: string }

export type JudgeCase = z.infer<typeof JudgeCaseSchema>
export type JudgeOutcome = z.infer<typeof JudgeOutcomeSchema>
export type JudgeCaseResult = z.infer<typeof JudgeCaseResultSchema>
export type JudgeConfig = z.infer<typeof JudgeConfigSchema>
