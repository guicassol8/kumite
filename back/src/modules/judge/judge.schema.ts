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
  'field_value_not_allowed',
  'disabled_block',
  'invalid_generated_code',
])

export const JudgeConfigSchema = z.object({
  timeoutMs: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  concurrency: z.number().int().positive(),
})

// --- Timings for the load harness (#137) ---
//
// One judged submission, as GET /organizer/stats/process reports it. All
// durations in milliseconds, all instants in epoch milliseconds.
const nonNegative = z.number().nonnegative()
const count = z.number().int().nonnegative()

export const JudgeRunSchema = z.object({
  // Increases by one per run in this process; the harness dedupes by it.
  seq: z.number().int().positive(),
  arrivedAt: count,
  endedAt: count,
  // Submissions waiting for a slot right after this one arrived, itself
  // included: 0 when a slot was free.
  waitingAtArrival: count,
  // Arrival to slot.
  queueMs: nonNegative,
  // Slot to the worker's `ready` (QuickJS loaded): 0 on a warm pooled
  // worker (#277), null when the worker never announced it (it died first).
  spawnMs: nonNegative.nullable(),
  // `ready` (else the slot; the slot on a warm worker) to the last case's
  // reply.
  execMs: nonNegative,
  // The sum of the per-case times the worker itself measured.
  caseMs: nonNegative,
  cases: count,
  // The worst case: timeout > runtime_error > failed > passed.
  outcome: JudgeOutcomeSchema,
})

export const JudgeTimingsSchema = z.object({
  // What this process judges with (JUDGE_CONCURRENCY and friends): proves an
  // override took.
  config: JudgeConfigSchema,
  // `alive = spawned - exited`; `idle` the pooled workers waiting for a
  // submission (#277). `alive - idle` above zero with nothing in flight is a
  // leaked worker.
  workers: z.object({ spawned: count, exited: count, alive: count, idle: count }),
  // Oldest first, the last 512.
  runs: z.array(JudgeRunSchema),
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
export type JudgeRun = z.infer<typeof JudgeRunSchema>
export type JudgeRunOutcome = JudgeRun['outcome']
export type JudgeTimings = z.infer<typeof JudgeTimingsSchema>
