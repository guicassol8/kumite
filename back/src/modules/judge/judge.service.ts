import { isDeepStrictEqual } from 'node:util'
import { Worker } from 'node:worker_threads'

import { BlocksError, type BlocksErrorCode, DEFAULT_LOCALE, generateSolution } from '@kumite/blocks'

import { JUDGE_CONCURRENCY, JUDGE_MEMORY_MB, JUDGE_TIMEOUT_MS } from '../../config'
import type { JsonValue } from '../../lib/json'
import type { Locale } from '../../lib/locale'
import type { SandboxCaseRequest, SandboxResult } from '../../sandbox-engine.worker'
import type {
  CodegenErrorCode,
  GenerateSourceResult,
  JudgeCase,
  JudgeCaseResult,
  JudgeConfig,
  Workspace,
} from './judge.schema'

// Spelled out rather than derived by replacing dashes: a new code in
// @kumite/blocks then breaks this table at typecheck instead of leaking a
// kebab-case string the route and the client have never heard of.
const CODEGEN_ERROR_CODES: Record<BlocksErrorCode, CodegenErrorCode> = {
  'malformed-workspace': 'malformed_workspace',
  'missing-root': 'missing_root',
  'duplicate-root': 'duplicate_root',
  'block-not-allowed': 'block_not_allowed',
  'field-value-not-allowed': 'field_value_not_allowed',
  'disabled-block': 'disabled_block',
  'invalid-generated-code': 'invalid_generated_code',
}

/**
 * Turns a serialized workspace into the `solve(input)` source the sandbox
 * runs — the same `generateSolution` the editor calls, so editor and judge
 * can never disagree about what a set of blocks means.
 *
 * The refusals come back as data for the route to map to a 400. Anything else
 * thrown is a genuine bug and propagates, becoming a 500 at kata's edge.
 */
export function generateJudgeSource(
  workspace: Workspace,
  locale: Locale = DEFAULT_LOCALE,
): GenerateSourceResult {
  try {
    return { ok: true, source: generateSolution(workspace, locale) }
  } catch (cause) {
    if (!(cause instanceof BlocksError)) throw cause
    return {
      ok: false,
      error: CODEGEN_ERROR_CODES[cause.code],
      // Already localized by the blocks package — no string is coined here.
      message: cause.message,
      ...(cause.blockType === undefined ? {} : { blockType: cause.blockType }),
    }
  }
}

type WorkerMessage = { type: 'ready' } | ({ type: 'result'; id: number } & SandboxResult)

const WORKER_URL = new URL('../../../dist/sandbox-engine.worker.js', import.meta.url)
// Generous slack past timeoutMs (ADR-0001) — this only fires if the worker
// never replies at all, it is not a tight bound on normal execution.
const WATCHDOG_SLACK_MS = 5000

function defaultConfig(): JudgeConfig {
  return { timeoutMs: JUDGE_TIMEOUT_MS, memoryMb: JUDGE_MEMORY_MB, concurrency: JUDGE_CONCURRENCY }
}

// Module-level counting semaphore: bounds how many runJudge() calls have a
// worker spawned at once. Calls beyond the limit await their turn instead of
// being rejected (Acceptance: "aguardam", never refuse).
let inFlight = 0
const waiting: Array<() => void> = []

function acquireSlot(limit: number): Promise<void> {
  if (inFlight < limit) {
    inFlight++
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    waiting.push(() => {
      inFlight++
      resolve()
    })
  })
}

function releaseSlot(): void {
  inFlight--
  const next = waiting.shift()
  next?.()
}

/**
 * Snapshot of the semaphore above, for the organizer's live card (#279):
 * submissions with a worker spawned right now, and those queued for a slot.
 * Read-only — observing the queue never changes it.
 */
export function getJudgeLoad(): { inFlight: number; waiting: number } {
  return { inFlight, waiting: waiting.length }
}

function toJudgeResult(result: SandboxResult, expected: JsonValue): JudgeCaseResult {
  switch (result.outcome) {
    case 'ok':
      return isDeepStrictEqual(result.value, expected)
        ? { outcome: 'passed', ms: result.ms }
        : { outcome: 'failed', expected, actual: result.value as JsonValue, ms: result.ms }
    case 'timeout':
      return { outcome: 'timeout', ms: result.ms }
    case 'memory':
    case 'blocked':
    case 'error':
      return { outcome: 'runtime_error', detail: result.detail ?? result.outcome, ms: result.ms }
  }
}

type CaseOutcome =
  | { kind: 'result'; result: SandboxResult }
  | { kind: 'exit' }
  | { kind: 'watchdog' }

/** Runs one case in an already-spawned worker. Resolves 'exit' if the worker
 * dies before replying, 'watchdog' if it simply never replies in time. */
function runOneCase(
  worker: Worker,
  request: SandboxCaseRequest,
  watchdogMs: number,
): Promise<CaseOutcome> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: CaseOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      worker.off('message', onMessage)
      worker.off('exit', onExit)
      worker.off('error', onError)
      resolve(outcome)
    }

    const watchdog = setTimeout(() => finish({ kind: 'watchdog' }), watchdogMs)
    const onMessage = (msg: WorkerMessage) => {
      if (msg.type !== 'result' || msg.id !== request.id) return
      const { type, id, ...result } = msg
      finish({ kind: 'result', result })
    }
    const onExit = () => finish({ kind: 'exit' })
    const onError = () => finish({ kind: 'exit' })

    worker.on('message', onMessage)
    worker.on('exit', onExit)
    worker.on('error', onError)
    worker.postMessage(request)
  })
}

/** Runs `source`'s `solve` against every case, one worker per submission. */
export async function runJudge(
  source: string,
  cases: JudgeCase[],
  config?: JudgeConfig,
): Promise<JudgeCaseResult[]> {
  return runJudgeAgainstWorker(WORKER_URL, source, cases, config)
}

/**
 * Test seam: lets judge.test.ts point the same protocol/cascading logic at
 * a worker double that can deterministically crash mid-submission — the
 * real QuickJS engine's memory-limit path could not be forced to do that
 * reliably on this machine (its own accounting always wins gracefully
 * before the worker's resourceLimits do). Never used outside tests.
 */
export async function runJudgeAgainstWorker(
  workerUrl: URL,
  source: string,
  cases: JudgeCase[],
  config?: JudgeConfig,
): Promise<JudgeCaseResult[]> {
  const cfg = config ?? defaultConfig()
  await acquireSlot(cfg.concurrency)
  const worker = new Worker(workerUrl, {
    resourceLimits: { maxOldGenerationSizeMb: cfg.memoryMb * 2 },
  })

  const results: JudgeCaseResult[] = []
  try {
    // Once the worker dies, every remaining case (the one in flight, plus
    // every case after it) is marked runtime_error without ever reaching the
    // worker — no respawn/retry mid-submission (a new submission always
    // gets its own fresh worker regardless).
    let workerDied = false
    for (const [id, judgeCase] of cases.entries()) {
      if (workerDied) {
        results.push({
          outcome: 'runtime_error',
          detail: 'worker exited earlier in this submission',
          ms: 0,
        })
        continue
      }

      const request: SandboxCaseRequest = {
        id,
        source,
        input: judgeCase.input,
        timeoutMs: cfg.timeoutMs,
        memoryMb: cfg.memoryMb,
      }
      const outcome = await runOneCase(worker, request, cfg.timeoutMs + WATCHDOG_SLACK_MS)
      if (outcome.kind === 'watchdog') {
        results.push({
          outcome: 'runtime_error',
          detail: 'no reply from worker (watchdog)',
          ms: cfg.timeoutMs + WATCHDOG_SLACK_MS,
        })
      } else if (outcome.kind === 'exit') {
        workerDied = true
        results.push({ outcome: 'runtime_error', detail: 'worker exited without a result', ms: 0 })
      } else {
        results.push(toJudgeResult(outcome.result, judgeCase.expected))
      }
    }
  } finally {
    void worker.terminate()
    releaseSlot()
  }

  return results
}
