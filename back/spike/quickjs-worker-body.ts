import { parentPort } from 'node:worker_threads'

import {
  newQuickJSWASMModule,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
  shouldInterruptAfterDeadline,
} from 'quickjs-emscripten'

import type { CaseOutcome, CaseResult } from './harness'

/**
 * Runs inside the worker spawned by engine-quickjs-worker.ts (candidate D).
 * One module load for the worker's lifetime; a fresh QuickJS runtime+context
 * per case, same rule as candidate B (engine-quickjs.ts) — this file is that
 * same execution logic, just relocated off the main thread.
 */

type CaseRequest = {
  id: number
  source: string
  timeoutMs: number
  memoryMb: number
  input: unknown
}

function classifyErrorMessage(message: string): CaseOutcome {
  if (/interrupted/i.test(message)) return 'timeout'
  if (/out of memory|memory/i.test(message)) return 'memory'
  return 'blocked'
}

function describeError(context: QuickJSContext, errorHandle: QuickJSHandle): string {
  const detail = context.dump(errorHandle)
  errorHandle.dispose()
  return typeof detail === 'object' && detail !== null ? JSON.stringify(detail) : String(detail)
}

function runCase(module: QuickJSWASMModule, request: CaseRequest): CaseResult {
  const { source, timeoutMs, memoryMb, input } = request
  const start = performance.now()
  const runtime = module.newRuntime()
  try {
    runtime.setMemoryLimit(memoryMb * 1024 * 1024)
    const deadline = Date.now() + timeoutMs
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
    const context = runtime.newContext()
    try {
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

      const settled = context.evalCode('JSON.stringify(globalThis.__settled)')
      const ms = performance.now() - start
      if (settled.error) {
        const detail = describeError(context, settled.error)
        return { outcome: classifyErrorMessage(detail), detail, ms }
      }
      const raw = context.dump(settled.value) as string | undefined
      settled.value.dispose()
      if (raw === undefined) {
        return { outcome: 'blocked', detail: 'promise never settled within the deadline', ms }
      }
      const parsed = JSON.parse(raw) as { ok: boolean; v?: unknown; e?: string }
      return parsed.ok
        ? { outcome: 'ok', value: parsed.v, ms }
        : { outcome: 'blocked', detail: parsed.e, ms }
    } finally {
      context.dispose()
    }
  } catch (cause) {
    const ms = performance.now() - start
    const detail = cause instanceof Error ? cause.message : String(cause)
    const outcome: CaseOutcome = /memory/i.test(detail) ? 'memory' : 'error'
    return { outcome, detail, ms }
  } finally {
    runtime.dispose()
  }
}

async function main(): Promise<void> {
  const module = await newQuickJSWASMModule()
  parentPort?.postMessage({ type: 'ready' })
  parentPort?.on('message', (request: CaseRequest) => {
    const result = runCase(module, request)
    parentPort?.postMessage({ type: 'result', id: request.id, ...result })
  })
}

void main()
