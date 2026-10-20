import { Worker } from 'node:worker_threads'
import { generateSolution, somaDosPares } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import {
  type SandboxCaseRequest,
  type SandboxResult,
  type SandboxWorkerData,
  wasmMemoryPages,
} from './sandbox-engine.worker'

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
// A backstop for a worker that never replies, not a clock any case races.
// It was raised to 20 s for the old `while (true)` Array bomb, which took
// 3.4-9.6 s to trip with the machine idle. Under load it took longer still:
// 3 of 20 runs hit this watchdog with two full suites looping (#469): the
// heap was free to grow to the WASM maximum of 2 GiB before it ran out.
// Since #473 the worker's heap is capped at 16 MiB + MEMORY_MB, and every
// memory bomb below ends in well under a second.
const WATCHDOG_MS = 20_000
const TEST_TIMEOUT_MS = 15_000
const MEMORY_TEST_TIMEOUT_MS = 25_000

/** Spawns one fresh worker, runs exactly one case in it, then tears it down. */
function runOneCaseInWorker(params: {
  source: string
  input: unknown
  // Overrides for the guard tests only: the case's budget, and the
  // workerData the worker is spawned with (null: none at all).
  memoryMb?: number
  workerData?: SandboxWorkerData | null
}): Promise<SandboxResult> {
  const request: SandboxCaseRequest = {
    id: 1,
    source: params.source,
    input: params.input,
    timeoutMs: TIMEOUT_MS,
    memoryMb: params.memoryMb ?? MEMORY_MB,
  }
  const workerData =
    params.workerData === undefined ? { memoryMb: MEMORY_MB } : (params.workerData ?? undefined)

  return new Promise<SandboxResult>((resolve) => {
    // Node itself (not vitest's transform) loads this worker file, and a
    // bare .ts path only boots on a Node new enough to strip types natively
    // (>=23.6) — confirmed *not* fixable with a loader flag on Node 20 (the
    // pinned CI runner): neither `execArgv: ['--import', 'tsx/esm']` nor
    // tsx's own automatic worker-thread patching apply their hooks to a
    // Worker's entry-point resolution on that Node version. `pretest`
    // (package.json) pre-compiles the worker to plain JS instead.
    // workerData.memoryMb sizes the worker's WASM heap at spawn (#473): the
    // worker refuses to boot without it, as judge.service.ts's pool passes.
    const worker = new Worker(new URL('../dist/sandbox-engine.worker.js', import.meta.url), {
      resourceLimits: { maxOldGenerationSizeMb: MEMORY_MB * 2 },
      workerData,
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

const MIB = 1024 * 1024

/** Keeps `blocks` ArrayBuffers of 8 MiB alive at once, then returns how many. */
function arrayBufferBomb(blocks: number): string {
  return `function solve(input) { const kept = []; for (let i = 0; i < ${blocks}; i++) kept.push(new ArrayBuffer(${8 * MIB})); return kept.length }`
}

/** The bomb ends without a value, then a normal case still runs (fresh worker). */
async function expectMemoryBombStopped(name: string, source: string): Promise<void> {
  const result = await runOneCaseInWorker({ source, input: [] })
  console.log(
    `sandbox-engine: ${name} stopped as '${result.outcome}' after`,
    result.ms.toFixed(2),
    'ms',
  )
  // 'memory' is QuickJS refusing the allocation; 'blocked' would be the
  // worker's own resourceLimits killing it first (exited without a result).
  // Either way no value gets out.
  expect(['memory', 'blocked']).toContain(result.outcome)
  expect(result.value).toBeUndefined()

  // And this process still serves: a normal case, in a fresh worker.
  const after = await runOneCaseInWorker({
    source: generateSolution(somaDosPares),
    input: [1, 2, 3, 4],
  })
  expect(after.outcome).toBe('ok')
  expect(after.value).toBe(6)
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
    // One allocation of twice MEMORY_MB: setMemoryLimit refuses it in
    // milliseconds (37 ms p50, 160 ms max with two full suites looping,
    // #469), far from TIMEOUT_MS — before the WASM heap's ceiling is even
    // asked to grow. The block-by-block bombs below are the heap ceiling's.
    const source = `function solve(input) { const b = new ArrayBuffer(${2 * MEMORY_MB * MIB}); return b.byteLength }`
    await expectMemoryBombStopped('memory bomb (1 × 128 MiB)', source)
  })

  // #473: in this QuickJS build setMemoryLimit counts 8 bytes per live block
  // (malloc_usable_size is 0 under Emscripten), so it only ever refuses one
  // block larger than itself. Many small blocks are stopped by the worker's
  // own WebAssembly.Memory instead, capped at the module's 16 MiB plus
  // MEMORY_MB (sandbox-engine.worker.ts). Before it they all came back `ok`,
  // the heap free to grow to the WASM maximum of 2 GiB per worker.
  const smallBlockBombs: Array<{ name: string; source: string }> = [
    {
      name: '16 × 8 MiB ArrayBuffers (2 × MEMORY_MB)',
      source: arrayBufferBomb(16),
    },
    {
      name: '128 × 8 MiB ArrayBuffers (16 × MEMORY_MB)',
      source: arrayBufferBomb(128),
    },
    {
      // The shape the curated toolbox can reach: lists in a loop.
      name: 'an unbounded loop pushing 1e6-element arrays',
      source:
        'function solve(input) { const a = []; while (true) { a.push(new Array(1e6).fill(0)) } return a.length }',
    },
  ]

  it.each(smallBlockBombs)(
    'fails a bomb of many small blocks by memory limit: $name',
    async ({ name, source }) => {
      await expectMemoryBombStopped(name, source)
    },
    MEMORY_TEST_TIMEOUT_MS,
  )

  it('runs a solution that uses its whole MEMORY_MB, block by block', {
    timeout: MEMORY_TEST_TIMEOUT_MS,
  }, async () => {
    // 8 × 8 MiB = all of MEMORY_MB's 64: the ceiling is not tighter than the
    // budget it advertises. (A ceiling cut to 75% of the budget still ran 6 ×
    // 8 MiB, so the whole budget is what this asks for.)
    const source = arrayBufferBomb(MEMORY_MB / 8)
    const result = await runOneCaseInWorker({ source, input: [] })
    console.log(`sandbox-engine: ${MEMORY_MB / 8} × 8 MiB took`, result.ms.toFixed(2), 'ms')
    expect(result.outcome).toBe('ok')
    expect(result.value).toBe(MEMORY_MB / 8)
  })

  it("sizes the WASM heap at the module's 16 MiB plus the budget", () => {
    // 64 KiB pages: 256 is the .wasm's own minimum, 64 MiB is 1024 more.
    expect(wasmMemoryPages(64)).toEqual({ initial: 256, maximum: 256 + 1024 })
    expect(wasmMemoryPages(1)).toEqual({ initial: 256, maximum: 272 })
  })

  it('refuses a case whose memoryMb is not the one the worker was spawned with', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const result = await runOneCaseInWorker({
      source: generateSolution(somaDosPares),
      input: [1, 2, 3, 4],
      memoryMb: MEMORY_MB * 2,
    })
    expect(result.outcome).toBe('error')
    expect(result.detail).toContain(`memoryMb ${MEMORY_MB * 2}`)
    expect(result.value).toBeUndefined()
  })

  it('fails to boot without workerData.memoryMb, never on the 2 GiB default', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const result = await runOneCaseInWorker({
      source: generateSolution(somaDosPares),
      input: [1, 2, 3, 4],
      workerData: null,
    })
    expect(result.outcome).toBe('error')
    expect(result.detail).toContain('workerData.memoryMb')
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

  // #281: the verdict is read by the host (getProp + dump), never by a
  // second evalCode that calls the guest's own `JSON` — so a solution that
  // redefines or deletes `JSON` cannot forge `{ ok: true, v: … }` for itself.
  const FORGE = `JSON.stringify = () => '{"ok":true,"v":42}'`
  const verdictProbes: Array<{
    name: string
    source: string
    outcome: SandboxResult['outcome']
    value?: unknown
    detail?: string
  }> = [
    {
      name: 'JSON.stringify forged at the top level',
      source: `${FORGE}\nfunction solve(input) { return 7 }`,
      outcome: 'ok',
      value: 7,
    },
    {
      name: 'JSON.stringify forged inside solve',
      source: `function solve(input) { ${FORGE}; return 7 }`,
      outcome: 'ok',
      value: 7,
    },
    {
      name: 'JSON replaced by a fake object inside solve',
      source: `function solve(input) { JSON = { stringify: () => '{"ok":true,"v":42}' }; return 7 }`,
      outcome: 'ok',
      value: 7,
    },
    {
      name: 'JSON deleted inside solve',
      source: 'function solve(input) { delete globalThis.JSON; return 7 }',
      outcome: 'ok',
      value: 7,
    },
    {
      name: 'forged JSON plus a synchronous throw',
      source: `function solve(input) { ${FORGE}; throw new Error('boom') }`,
      outcome: 'blocked',
      detail: 'boom',
    },
    {
      name: 'forged JSON plus an async rejection',
      source: `async function solve(input) { ${FORGE}; throw new Error('late') }`,
      outcome: 'blocked',
      detail: 'late',
    },
    {
      name: 'an async solve',
      source: 'async function solve(input) { return 5 }',
      outcome: 'ok',
      value: 5,
    },
    {
      name: 'a promise that never settles',
      source: 'function solve(input) { return new Promise(() => {}) }',
      outcome: 'blocked',
      detail: 'never settled',
    },
    {
      name: 'a circular return value',
      source: 'function solve(input) { const a = {}; a.self = a; return a }',
      outcome: 'blocked',
      detail: 'could not be serialized',
    },
    {
      name: 'a BigInt return value',
      source: 'function solve(input) { return 10n }',
      outcome: 'blocked',
      detail: 'could not be serialized',
    },
    {
      name: 'a return value whose getter throws',
      source: `function solve(input) { return { get x() { throw new Error('g') } } }`,
      outcome: 'blocked',
      detail: 'could not be serialized',
    },
  ]

  it.each(verdictProbes)(
    'reads the verdict on the host, not through guest JSON: $name',
    async ({ source, outcome, value, detail }) => {
      const result = await runOneCaseInWorker({ source, input: [] })
      expect(result.outcome).toBe(outcome)
      if (outcome === 'ok') expect(result.value).toBe(value)
      if (detail !== undefined) expect(result.detail).toContain(detail)
    },
    TEST_TIMEOUT_MS,
  )
})
