import { isMainThread, parentPort, workerData } from 'node:worker_threads'

import {
  newQuickJSWASMModule,
  newVariant,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
  RELEASE_SYNC,
  shouldInterruptAfterDeadline,
} from 'quickjs-emscripten'

/**
 * Worker-thread entry point for the judge sandbox engine — ADR-0001
 * (back/docs/adr/0001-judge-sandbox-engine.md): quickjs-emscripten runs
 * inside a `worker_thread`, a fresh QuickJS runtime+context per test case.
 * Since #277 a worker serves many submissions from judge.service.ts's warm
 * pool (ADR-0001's Amendment): nothing of a guest survives its case, and the
 * QuickJS module loaded below is the only state a submission inherits.
 *
 * Spawned by sandbox-engine.test.ts for characterization; #19 owns the
 * production request/reply protocol and lifecycle (respawn on crash,
 * concurrency queue) around this same execution logic.
 *
 * Memory (#473, ADR-0001's "total memory ceiling" amendment): the worker is
 * spawned with `workerData.memoryMb`, and its whole WASM heap is capped at
 * the module's own 16 MiB plus that budget — see wasmMemoryPages below.
 */

export type SandboxOutcome = 'ok' | 'timeout' | 'memory' | 'blocked' | 'error'

export type SandboxResult = {
  outcome: SandboxOutcome
  value?: unknown
  detail?: string
  ms: number
}

export type SandboxCaseRequest = {
  id: number
  source: string
  timeoutMs: number
  memoryMb: number
  input: unknown
}

export type SandboxWorkerData = { memoryMb: number }

// The global exists in every Node, but neither `lib: ["ES2022"]` nor
// @types/node 20 types it: declared here, for this one constructor only.
declare const WebAssembly: {
  Memory: new (descriptor: {
    initial: number
    maximum: number
  }) => Parameters<typeof newVariant>[1]['wasmMemory']
}

// One WebAssembly page is 64 KiB.
const PAGES_PER_MIB = 16
// The minimum the release-sync .wasm declares for its imported memory (256
// pages = 16 MiB): a smaller `initial` fails to instantiate.
const MODULE_INITIAL_PAGES = 256

/**
 * The worker's WebAssembly.Memory size, in pages: the module's own 16 MiB
 * plus `memoryMb` for the solution. This is the total memory ceiling (#473).
 * `runtime.setMemoryLimit` cannot be one in this QuickJS build: under
 * Emscripten its malloc_usable_size is 0, so the running total grows by 8
 * bytes per block and only a single block larger than the limit is refused.
 * Past `maximum`, Emscripten's heap resize catches the failed `grow` and
 * malloc returns NULL — QuickJS throws `out of memory`, no abort.
 */
export function wasmMemoryPages(memoryMb: number): { initial: number; maximum: number } {
  return {
    initial: MODULE_INITIAL_PAGES,
    maximum: MODULE_INITIAL_PAGES + memoryMb * PAGES_PER_MIB,
  }
}

function classifyErrorMessage(message: string): SandboxOutcome {
  if (/interrupted/i.test(message)) return 'timeout'
  if (/out of memory|memory/i.test(message)) return 'memory'
  return 'blocked'
}

function describeError(context: QuickJSContext, errorHandle: QuickJSHandle): string {
  const detail = context.dump(errorHandle)
  errorHandle.dispose()
  return typeof detail === 'object' && detail !== null ? JSON.stringify(detail) : String(detail)
}

function runCase(
  module: QuickJSWASMModule,
  spawnMemoryMb: number,
  request: SandboxCaseRequest,
): SandboxResult {
  const { source, input, timeoutMs, memoryMb } = request
  const start = performance.now()
  if (memoryMb !== spawnMemoryMb) {
    // The heap ceiling was fixed at spawn: never run a case under a budget
    // this worker was not sized for. 'error' discards the worker.
    const detail = `case asked for memoryMb ${memoryMb}, worker spawned with ${spawnMemoryMb}`
    return { outcome: 'error', detail, ms: performance.now() - start }
  }
  const runtime = module.newRuntime()
  try {
    // Kept as a fast path: it refuses one oversized block at once, before
    // the heap is asked to grow. The total is capped by the WASM memory.
    runtime.setMemoryLimit(memoryMb * 1024 * 1024)
    const deadline = Date.now() + timeoutMs
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
    const context = runtime.newContext()
    try {
      // Route the call through `.then`/`.catch` onto a global rather than
      // trusting evalCode's raw result: `solve` may return a Promise (e.g. a
      // stray dynamic `import()`), and evalCode never drains microtasks on
      // its own — an unresolved promise would silently read back as "ok".
      const code = `
        globalThis.__settled = undefined
        Promise.resolve(solve(${JSON.stringify(input)}))
          .then((v) => { globalThis.__settled = { ok: true, v } })
          .catch((e) => { globalThis.__settled = { ok: false, e: e instanceof Error ? e.message : String(e) } })
        undefined
      `
      const started = context.evalCode(`${source}\n${code}`)
      if (started.error) {
        const detail = describeError(context, started.error)
        return { outcome: classifyErrorMessage(detail), detail, ms: performance.now() - start }
      }
      started.value.dispose()
      runtime.executePendingJobs()

      // Read the verdict from the host (#281), never through a second
      // evalCode: `JSON.stringify(globalThis.__settled)` would call whatever
      // `JSON` the guest left behind, so a solution could redefine it and
      // forge `{ ok: true, v: … }`. `dump` serializes in C (QTS_Dump), blind
      // to the guest's globals. When that serialization fails (BigInt,
      // circular, throwing getter) dump silently falls back to a string —
      // the envelope is always an object with a boolean `ok`, so anything
      // else is treated as unserializable, exactly as the old path threw.
      // Not sealed by this: `dump` still honors a guest `toJSON` on
      // Object.prototype, and a guest accessor on `__settled` or a redefined
      // `Promise` can still shape the envelope — none is reachable from the
      // curated toolbox (#181), and none gives more than `return <value>`.
      const handle = context.getProp(context.global, '__settled')
      let settled: unknown
      try {
        settled = context.dump(handle)
      } finally {
        if (handle.alive) handle.dispose()
      }
      const ms = performance.now() - start
      if (settled === undefined) {
        return { outcome: 'blocked', detail: 'promise never settled within the deadline', ms }
      }
      if (
        typeof settled !== 'object' ||
        settled === null ||
        typeof (settled as { ok?: unknown }).ok !== 'boolean'
      ) {
        return { outcome: 'blocked', detail: 'result could not be serialized', ms }
      }
      const envelope = settled as { ok: boolean; v?: unknown; e?: string }
      return envelope.ok
        ? { outcome: 'ok', value: envelope.v, ms }
        : { outcome: 'blocked', detail: envelope.e, ms }
    } finally {
      context.dispose()
    }
  } catch (cause) {
    const ms = performance.now() - start
    const detail = cause instanceof Error ? cause.message : String(cause)
    const outcome: SandboxOutcome = /memory/i.test(detail) ? 'memory' : 'error'
    return { outcome, detail, ms }
  } finally {
    runtime.dispose()
  }
}

function readMemoryMb(data: unknown): number {
  const memoryMb = (data as Partial<SandboxWorkerData> | null)?.memoryMb
  if (typeof memoryMb !== 'number' || !Number.isInteger(memoryMb) || memoryMb <= 0) {
    // Fail the boot loud: without a budget the heap could grow to the WASM
    // maximum of 2 GiB. The pool already handles a worker's 'error'/'exit'.
    throw new Error(
      `sandbox worker needs workerData.memoryMb (a positive integer), got ${memoryMb}`,
    )
  }
  return memoryMb
}

async function main(): Promise<void> {
  const memoryMb = readMemoryMb(workerData)
  const variant = newVariant(RELEASE_SYNC, {
    wasmMemory: new WebAssembly.Memory(wasmMemoryPages(memoryMb)),
  })
  const module = await newQuickJSWASMModule(variant)
  parentPort?.postMessage({ type: 'ready' })
  parentPort?.on('message', (request: SandboxCaseRequest) => {
    const result = runCase(module, memoryMb, request)
    parentPort?.postMessage({ type: 'result', id: request.id, ...result })
  })
}

if (!isMainThread) {
  main().catch((cause: unknown) => {
    // Rethrown outside the promise so it reaches the parent as the worker's
    // 'error' event, not an unhandled rejection's warning.
    setImmediate(() => {
      throw cause
    })
  })
}
