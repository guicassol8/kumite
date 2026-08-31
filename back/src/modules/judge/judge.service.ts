import { isDeepStrictEqual } from 'node:util'
import { Worker } from 'node:worker_threads'

import { JUDGE_CONCURRENCY, JUDGE_MEMORY_MB, JUDGE_TIMEOUT_MS } from '../../config'
import type { JsonValue } from '../../lib/json'
import type { SandboxCaseRequest, SandboxResult } from '../../sandbox-engine.worker'
import type { JudgeCase, JudgeCaseResult, JudgeConfig } from './judge.schema'

type WorkerMessage = { type: 'ready' } | ({ type: 'result'; id: number } & SandboxResult)

const WORKER_URL = new URL('../../../dist/sandbox-engine.worker.js', import.meta.url)
// Generous slack past timeoutMs (ADR-0001) — this only fires if the worker
// never replies at all, it is not a tight bound on normal execution.
const WATCHDOG_SLACK_MS = 5000

function defaultConfig(): JudgeConfig {
  return { timeoutMs: JUDGE_TIMEOUT_MS, memoryMb: JUDGE_MEMORY_MB, concurrency: JUDGE_CONCURRENCY }
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
  const cfg = config ?? defaultConfig()
  const worker = new Worker(WORKER_URL, {
    resourceLimits: { maxOldGenerationSizeMb: cfg.memoryMb * 2 },
  })

  const results: JudgeCaseResult[] = []
  try {
    for (const [id, judgeCase] of cases.entries()) {
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
        results.push({ outcome: 'runtime_error', detail: 'worker exited without a result', ms: 0 })
      } else {
        results.push(toJudgeResult(outcome.result, judgeCase.expected))
      }
    }
  } finally {
    void worker.terminate()
  }

  return results
}
