import { Worker } from 'node:worker_threads'
import { generateSolution, somaDosPares } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import type { SandboxCaseRequest, SandboxResult } from './sandbox-engine.worker'

/**
 * Behavioral characterization of the judge sandbox engine chosen in
 * ADR-0001 (back/docs/adr/0001-judge-sandbox-engine.md) — quickjs-emscripten
 * inside a worker_thread, one worker per case here (real production usage is
 * one worker per submission, reused across that submission's cases — see the
 * ADR's Decision section; per-case here keeps each test independent).
 *
 * Not a benchmark: a number measured here in CI is flaky by nature (shared
 * runners, noisy neighbors). Timings are printed for visibility only, never
 * asserted — what's asserted is behavior: correct output, timeout without
 * crashing the *main* process, memory-limit without crashing the main
 * process (the worker itself is expected to exit on a memory-limit hit —
 * see the second test below), and every hostile probe blocked. #19 ports
 * this same engine into src/modules/judge/ as the real execution service,
 * with the worker-per-submission lifecycle and respawn-on-crash handling;
 * this file exists so a regression in the engine itself fails loud here
 * first.
 */

type WorkerMessage = { type: 'ready' } | ({ type: 'result'; id: number } & SandboxResult)

const TIMEOUT_MS = 2000
const MEMORY_MB = 64
// The memory-bomb probe measured ~3.4-3.85s to trip in the spike's session —
// well past TIMEOUT_MS — because QuickJS's own memory accounting, not an
// external clock, is what stops it. On this machine it took exactly 8000ms
// three runs in a row, i.e. the old WATCHDOG_MS was racing (and losing to)
// the real detection instead of just backstopping it. Raised with headroom
// past any measured trip.
const WATCHDOG_MS = 20_000
const TEST_TIMEOUT_MS = 15_000
const MEMORY_TEST_TIMEOUT_MS = 25_000

/** Spawns one fresh worker, runs exactly one case in it, then tears it down. */
function runOneCaseInWorker(params: { source: string; input: unknown }): Promise<SandboxResult> {
  const request: SandboxCaseRequest = {
    id: 1,
    source: params.source,
    input: params.input,
    timeoutMs: TIMEOUT_MS,
    memoryMb: MEMORY_MB,
  }

  return new Promise<SandboxResult>((resolve) => {
    // Node itself (not vitest's transform) loads this worker file, and a
    // bare .ts path only boots on a Node new enough to strip types natively
    // (>=23.6) — confirmed *not* fixable with a loader flag on Node 20 (the
    // pinned CI runner): neither `execArgv: ['--import', 'tsx/esm']` nor
    // tsx's own automatic worker-thread patching apply their hooks to a
    // Worker's entry-point resolution on that Node version. `pretest`
    // (package.json) pre-compiles the worker to plain JS instead.
    const worker = new Worker(new URL('../dist/sandbox-engine.worker.js', import.meta.url), {
      resourceLimits: { maxOldGenerationSizeMb: MEMORY_MB * 2 },
    })

    let settled = false
    const finish = (result: SandboxResult) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      resolve(result)
      void worker.terminate()
    }

    const watchdog = setTimeout(() => {
      finish({ outcome: 'timeout', detail: 'no reply from worker (watchdog)', ms: WATCHDOG_MS })
    }, WATCHDOG_MS)

    worker.on('message', (msg: WorkerMessage) => {
      if (msg.type !== 'result') return
      const { type, id, ...result } = msg
      finish(result)
    })
    worker.on('error', (err) => {
      finish({ outcome: 'error', detail: `worker crashed: ${err.message}`, ms: 0 })
    })
    worker.on('exit', (code) => {
      // A clean 'result' message already resolved via finish() above; this
      // only fires for a case that never replied — process.exit() inside
      // the sandbox, or the worker dying before it could post a message.
      if (!settled) {
        finish({
          outcome: 'blocked',
          detail: `worker exited (code ${code}) without a result`,
          ms: 0,
        })
      }
    })

    worker.postMessage(request)
  })
}

describe('sandbox engine (ADR-0001: quickjs-emscripten inside worker_thread)', () => {
  it('runs the generated solve(input) and returns the correct result', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const source = generateSolution(somaDosPares)
    const result = await runOneCaseInWorker({ source, input: [1, 2, 3, 4] })
    console.log('sandbox-engine: solve(input) took', result.ms.toFixed(2), 'ms')
    expect(result.outcome).toBe('ok')
    expect(result.value).toBe(6) // sum of the even numbers: 2 + 4
  })

  it('fails an infinite loop by timeout, without crashing the main process', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const source = 'function solve(input) { let x = 0; while (true) { x = x + 1 } return x }'
    const result = await runOneCaseInWorker({ source, input: [] })
    console.log('sandbox-engine: infinite loop stopped after', result.ms.toFixed(2), 'ms')
    expect(result.outcome).toBe('timeout')
  })

  it('fails a memory bomb by memory limit — the worker exits, the main process does not', {
    timeout: MEMORY_TEST_TIMEOUT_MS,
  }, async () => {
    const source =
      'function solve(input) { const a = []; while (true) { a.push(new Array(1e6).fill(0)) } return a.length }'
    const result = await runOneCaseInWorker({ source, input: [] })
    console.log('sandbox-engine: memory bomb stopped after', result.ms.toFixed(2), 'ms')
    // QuickJS's own memory accounting can take multiple seconds to trip
    // (measured ~3.4-3.85s in this session) — either it reports 'memory'
    // itself, or the worker's own resourceLimits kill it first and this
    // reads back as 'blocked' (exited without a result). Both mean the
    // same thing operationally: the payload never got a value out, and
    // this test process is still running to say so.
    expect(['memory', 'blocked']).toContain(result.outcome)
  })

  const hostileProbes: Array<{ name: string; source: string }> = [
    {
      name: 'require',
      source: "function solve(input) { return require('node:fs').readdirSync('.') }",
    },
    { name: 'dynamic import', source: "function solve(input) { return import('node:fs') }" },
    { name: 'process', source: 'function solve(input) { return process.exit(0) }' },
    { name: 'fetch', source: "function solve(input) { return fetch('http://169.254.169.254/') }" },
  ]

  it.each(hostileProbes)(
    'blocks $name from inside the sandbox',
    async ({ source }) => {
      const result = await runOneCaseInWorker({ source, input: [] })
      expect(result.outcome).toBe('blocked')
    },
    TEST_TIMEOUT_MS,
  )
})
