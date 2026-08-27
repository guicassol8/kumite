import { deepEqual } from './deep-equal'
import { type SolutionWorker, spawnSolutionWorker } from './solution-worker'

/** A wrong solution is usually a wrong answer; 2s is what an infinite loop costs. */
export const EXAMPLE_TIMEOUT_MS = 2000

export type ExampleCase = {
  input: unknown
  expected: unknown
}

export type CaseOutcome =
  | { status: 'passed'; actual: unknown }
  | { status: 'failed'; actual: unknown }
  | { status: 'timeout' }
  | { status: 'error'; message: string }

export type RunExamplesOptions = {
  spawnWorker?: () => SolutionWorker
  timeoutMs?: number
  /** Fires as each case closes — this is what makes the panel fill in live. */
  onCaseSettled?: (index: number, outcome: CaseOutcome) => void
}

/**
 * Runs the generated solution against every example, one worker at a time.
 *
 * Sequential rather than concurrent: the outcomes then arrive in the order the
 * panel lists them, and the worst case is bounded by `examples.length ×
 * timeoutMs` instead of by however many workers the browser will start at once.
 *
 * A case never takes another one down — a timeout, a thrown error and a worker
 * that dies all settle into an outcome and the loop moves on.
 */
export async function runExamples(
  code: string,
  examples: readonly ExampleCase[],
  options: RunExamplesOptions = {},
): Promise<CaseOutcome[]> {
  const spawn = options.spawnWorker ?? spawnSolutionWorker
  const timeoutMs = options.timeoutMs ?? EXAMPLE_TIMEOUT_MS
  const outcomes: CaseOutcome[] = []

  for (const [index, example] of examples.entries()) {
    const outcome = await runCase(spawn, code, example, timeoutMs)
    outcomes.push(outcome)
    options.onCaseSettled?.(index, outcome)
  }

  return outcomes
}

function runCase(
  spawn: () => SolutionWorker,
  code: string,
  example: ExampleCase,
  timeoutMs: number,
): Promise<CaseOutcome> {
  return new Promise((resolve) => {
    const worker = spawn()
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false

    // Every path ends here, so the worker is always terminated and the timer
    // always cleared — including the one where the answer beat the clock by a
    // hair and both fire.
    const settle = (outcome: CaseOutcome) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      worker.terminate()
      resolve(outcome)
    }

    worker.onmessage = (event) => {
      const response = event.data
      if (!response.ok) {
        settle({ status: 'error', message: response.message })
        return
      }
      settle({
        status: deepEqual(response.value, example.expected) ? 'passed' : 'failed',
        actual: response.value,
      })
    }

    // Only reachable when the worker itself fails (a script that will not
    // load): anything `solve` throws is caught inside the worker and comes back
    // as a regular `ok: false` response.
    worker.onerror = (event) => {
      settle({ status: 'error', message: event.message })
    }

    timer = setTimeout(() => settle({ status: 'timeout' }), timeoutMs)
    worker.postMessage({ code, input: example.input })
  })
}
