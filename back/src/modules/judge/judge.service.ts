import { performance } from 'node:perf_hooks'
import { isDeepStrictEqual } from 'node:util'
import { Worker } from 'node:worker_threads'

import { BlocksError, type BlocksErrorCode, DEFAULT_LOCALE, generateSolution } from '@kumite/blocks'

import { JUDGE_CONCURRENCY, JUDGE_MEMORY_MB, JUDGE_TIMEOUT_MS } from '../../config'
import type { JsonValue } from '../../lib/json'
import type { Locale } from '../../lib/locale'
import { pushBounded } from '../../lib/ring'
import type {
  SandboxCaseRequest,
  SandboxResult,
  SandboxWorkerData,
} from '../../sandbox-engine.worker'
import type {
  CodegenErrorCode,
  GenerateSourceResult,
  JudgeCase,
  JudgeCaseResult,
  JudgeConfig,
  JudgeRun,
  JudgeRunOutcome,
  JudgeTimings,
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

// Module-level counting semaphore: bounds how many runJudge() calls hold a
// worker at once — and so how many workers the pool below ever holds. Calls
// beyond the limit await their turn instead of being rejected (Acceptance:
// "aguardam", never refuse).
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

// --- Timings for the load harness (#137) ---
//
// One entry per judged submission, kept in a bounded ring and read by
// GET /organizer/stats/process. Process-local like the semaphore above; the
// cost is a few performance.now() per submission.
const JUDGE_RUNS_KEEP = 512
const judgeRuns: JudgeRun[] = []
let runSeq = 0
let workersSpawned = 0
let workersExited = 0

// --- Warm worker pool (#277) ---
//
// Spawning a worker and loading QuickJS was 79–97% of a correct submission's
// judge time outside the queue (#137). A worker whose submission ended clean
// goes back to an idle list and the next submission reuses it. Reuse shares
// no guest state: every case still gets a fresh QuickJS runtime and context
// (ADR-0001, Amendment #277). Workers are created on demand — the pool grows
// to the semaphore's limit after that many simultaneous submissions and never
// shrinks; a discarded worker is replaced by the next submission that finds
// no idle one.
type PooledWorker = {
  worker: Worker
  // When the worker announced `ready` (QuickJS loaded: the spawn cost the
  // case timings, measured inside the worker, never include); null until then.
  readyAt: number | null
  // Set by its 'error' or 'exit': never handed out again.
  dead: boolean
}

// Keyed by worker URL and memory limit: the test seam gets its own pool, and
// a worker spawned with one resourceLimits never serves another.
const idleWorkers = new Map<string, PooledWorker[]>()

// Every case request gets an id never used before in this process: a late
// reply meant for an earlier submission can never be read as this one's.
let caseSeq = 0

function poolKey(workerUrl: URL, memoryMb: number): string {
  return `${workerUrl.href}|${memoryMb}`
}

function spawnWorker(key: string, workerUrl: URL, memoryMb: number): PooledWorker {
  const worker = new Worker(workerUrl, {
    resourceLimits: { maxOldGenerationSizeMb: memoryMb * 2 },
    // The sandbox caps its WASM heap with this at spawn, and refuses to boot
    // without it (#473): resourceLimits never reaches WASM memory.
    workerData: { memoryMb } satisfies SandboxWorkerData,
  })
  workersSpawned++
  const pooled: PooledWorker = { worker, readyAt: null, dead: false }
  // Bound once, for the worker's whole life. Without a permanent 'error'
  // listener, an idle worker emitting one would crash the main process.
  worker.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'ready' && pooled.readyAt === null) pooled.readyAt = performance.now()
  })
  worker.on('error', () => {
    pooled.dead = true
  })
  worker.once('exit', () => {
    workersExited++
    pooled.dead = true
    const idle = idleWorkers.get(key)
    const at = idle?.indexOf(pooled) ?? -1
    if (idle && at !== -1) idle.splice(at, 1)
  })
  return pooled
}

/** The most recently returned idle worker (LIFO), else a fresh one. */
function checkoutWorker(key: string, workerUrl: URL, memoryMb: number): PooledWorker {
  const idle = idleWorkers.get(key)
  while (idle && idle.length > 0) {
    const pooled = idle.pop()
    if (pooled && !pooled.dead) {
      pooled.worker.ref()
      return pooled
    }
  }
  return spawnWorker(key, workerUrl, memoryMb)
}

/** Back to the idle list if its submission ended clean, else terminated. An
 * idle worker is unref'd: it never keeps the process (or vitest) alive. */
function returnWorker(key: string, pooled: PooledWorker, clean: boolean): void {
  if (!clean || pooled.dead) {
    void pooled.worker.terminate()
    return
  }
  pooled.worker.unref()
  const idle = idleWorkers.get(key)
  if (idle) idle.push(pooled)
  else idleWorkers.set(key, [pooled])
}

function idleWorkerCount(): number {
  let total = 0
  for (const idle of idleWorkers.values()) total += idle.length
  return total
}

// Worst first: a submission whose loop timed out on one case is a timeout,
// whatever its other cases did — the same precedence the harness reads.
const OUTCOME_SEVERITY: Record<JudgeRunOutcome, number> = {
  timeout: 3,
  runtime_error: 2,
  failed: 1,
  passed: 0,
}

function worstOutcome(results: JudgeCaseResult[]): JudgeRunOutcome {
  if (results.length === 0) return 'failed'
  let worst: JudgeRunOutcome = 'passed'
  for (const { outcome } of results) {
    if (OUTCOME_SEVERITY[outcome] > OUTCOME_SEVERITY[worst]) worst = outcome
  }
  return worst
}

/**
 * The judge's recent runs, its worker counters and the configuration it
 * judges with. `alive = spawned - exited`, `idle` the pooled workers waiting
 * for a submission: `alive - idle` above zero with nothing in flight is a
 * leak this makes visible. Read-only.
 */
export function getJudgeTimings(): JudgeTimings {
  return {
    config: defaultConfig(),
    workers: {
      spawned: workersSpawned,
      exited: workersExited,
      alive: workersSpawned - workersExited,
      idle: idleWorkerCount(),
    },
    runs: [...judgeRuns],
  }
}

/**
 * Snapshot of the semaphore above, for the organizer's live card (#279):
 * submissions holding a worker right now, and those queued for a slot.
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

/** Runs one case in a checked-out worker. Resolves 'exit' if the worker
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

/** Runs `source`'s `solve` against every case, on one pooled worker per
 * submission. */
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
  const arrivedAt = Date.now()
  const arrived = performance.now()
  // Counting itself: 0 when a slot was free, n when n were queued, this one
  // included. Read before acquireSlot, which claims a free slot synchronously.
  const waitingAtArrival = inFlight < cfg.concurrency ? 0 : waiting.length + 1
  await acquireSlot(cfg.concurrency)
  const slotted = performance.now()

  const key = poolKey(workerUrl, cfg.memoryMb)
  const pooled = checkoutWorker(key, workerUrl, cfg.memoryMb)
  const { worker } = pooled

  const results: JudgeCaseResult[] = []
  let caseMs = 0
  // Whether the worker goes back to the pool (#277): no exit, no watchdog,
  // and no case that came back `memory` (WASM memory never shrinks, and an
  // OOM is where a corrupted QuickJS module would show — in the *next*
  // participant's submission) or `error` (a host-side failure, same reason).
  // `timeout` and `blocked` are ordinary guest outcomes and keep it.
  let clean = true
  try {
    // Once the worker dies, every remaining case (the one in flight, plus
    // every case after it) is marked runtime_error without ever reaching the
    // worker — no respawn/retry mid-submission (the next submission gets
    // another worker from the pool, or a fresh one).
    let workerDied = false
    for (const judgeCase of cases) {
      if (workerDied) {
        results.push({
          outcome: 'runtime_error',
          detail: 'worker exited earlier in this submission',
          ms: 0,
        })
        continue
      }

      caseSeq++
      const request: SandboxCaseRequest = {
        id: caseSeq,
        source,
        input: judgeCase.input,
        timeoutMs: cfg.timeoutMs,
        memoryMb: cfg.memoryMb,
      }
      const outcome = await runOneCase(worker, request, cfg.timeoutMs + WATCHDOG_SLACK_MS)
      if (outcome.kind === 'watchdog') {
        clean = false
        results.push({
          outcome: 'runtime_error',
          detail: 'no reply from worker (watchdog)',
          ms: cfg.timeoutMs + WATCHDOG_SLACK_MS,
        })
      } else if (outcome.kind === 'exit') {
        clean = false
        workerDied = true
        results.push({ outcome: 'runtime_error', detail: 'worker exited without a result', ms: 0 })
      } else {
        if (outcome.result.outcome === 'memory' || outcome.result.outcome === 'error') clean = false
        caseMs += outcome.result.ms
        results.push(toJudgeResult(outcome.result, judgeCase.expected))
      }
    }
  } finally {
    const finished = performance.now()
    // A warm worker was ready before this submission's slot: its spawn is 0
    // and its execution starts at the slot, never counting its idle time.
    const readyAt = pooled.readyAt === null ? null : Math.max(pooled.readyAt, slotted)
    returnWorker(key, pooled, clean)
    releaseSlot()
    runSeq++
    pushBounded(
      judgeRuns,
      {
        seq: runSeq,
        arrivedAt,
        endedAt: Date.now(),
        waitingAtArrival,
        queueMs: slotted - arrived,
        spawnMs: readyAt === null ? null : readyAt - slotted,
        execMs: finished - (readyAt ?? slotted),
        caseMs,
        cases: cases.length,
        outcome: results.length === cases.length ? worstOutcome(results) : 'runtime_error',
      },
      JUDGE_RUNS_KEEP,
    )
  }

  return results
}
