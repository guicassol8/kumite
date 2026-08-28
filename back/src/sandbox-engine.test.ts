import { generateSolution, somaDosPares } from '@kumite/blocks'
import {
  newQuickJSWASMModule,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
  shouldInterruptAfterDeadline,
} from 'quickjs-emscripten'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Behavioral characterization of the judge sandbox engine chosen in
 * ADR-0001 (back/docs/adr/0001-judge-sandbox-engine.md) — quickjs-emscripten,
 * in-process, fresh runtime+context per test case.
 *
 * Not a benchmark: a number measured here in CI is flaky by nature (shared
 * runners, noisy neighbors). Timings are printed for visibility only, never
 * asserted — what's asserted is behavior: correct output, timeout without
 * crashing the process, memory-limit without crashing the process, and every
 * hostile probe blocked. #19 ports this same engine into
 * src/modules/judge/ as the real execution service; this file exists so a
 * regression in the engine itself — not the service around it — fails loud
 * here first.
 */

type CaseOutcome = 'ok' | 'timeout' | 'memory' | 'blocked' | 'error'

type SandboxResult = {
  outcome: CaseOutcome
  value?: unknown
  detail?: string
  ms: number
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

/**
 * Runs `solve(input)` in a fresh runtime+context (never reused across
 * calls — the generated code declares its variables above `solve`, so
 * reuse would leak state between cases, see blocks/src/generate.ts).
 */
async function runInSandbox(
  module: QuickJSWASMModule,
  params: { source: string; input: unknown; timeoutMs: number; memoryMb: number },
): Promise<SandboxResult> {
  const { source, input, timeoutMs, memoryMb } = params
  const start = performance.now()
  const runtime = module.newRuntime()
  try {
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

const TIMEOUT_MS = 2000
const MEMORY_MB = 64
const TEST_TIMEOUT_MS = 10_000

describe('sandbox engine (ADR-0001: quickjs-emscripten, in-process)', () => {
  let module: QuickJSWASMModule

  beforeAll(async () => {
    module = await newQuickJSWASMModule()
  })

  it('runs the generated solve(input) and returns the correct result', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const source = generateSolution(somaDosPares)
    const result = await runInSandbox(module, {
      source,
      input: [1, 2, 3, 4],
      timeoutMs: TIMEOUT_MS,
      memoryMb: MEMORY_MB,
    })
    console.log('sandbox-engine: solve(input) took', result.ms.toFixed(2), 'ms')
    expect(result.outcome).toBe('ok')
    expect(result.value).toBe(6) // sum of the even numbers: 2 + 4
  })

  it('fails an infinite loop by timeout, without crashing the process', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const source = 'function solve(input) { let x = 0; while (true) { x = x + 1 } return x }'
    const result = await runInSandbox(module, {
      source,
      input: [],
      timeoutMs: TIMEOUT_MS,
      memoryMb: MEMORY_MB,
    })
    console.log('sandbox-engine: infinite loop stopped after', result.ms.toFixed(2), 'ms')
    expect(result.outcome).toBe('timeout')
  })

  it('fails a memory bomb by memory limit, without crashing the process', {
    timeout: TEST_TIMEOUT_MS,
  }, async () => {
    const source =
      'function solve(input) { const a = []; while (true) { a.push(new Array(1e6).fill(0)) } return a.length }'
    const result = await runInSandbox(module, {
      source,
      input: [],
      timeoutMs: TIMEOUT_MS,
      memoryMb: MEMORY_MB,
    })
    console.log('sandbox-engine: memory bomb stopped after', result.ms.toFixed(2), 'ms')
    expect(result.outcome).toBe('memory')
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
      const result = await runInSandbox(module, {
        source,
        input: [],
        timeoutMs: TIMEOUT_MS,
        memoryMb: MEMORY_MB,
      })
      expect(result.outcome).toBe('blocked')
    },
    TEST_TIMEOUT_MS,
  )
})
