import {
  newQuickJSWASMModule,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
  shouldInterruptAfterDeadline,
} from 'quickjs-emscripten'

import {
  CASE_COUNTS,
  type CaseOutcome,
  type CaseResult,
  type ExecuteCase,
  printEngineReport,
  REALISTIC_SOURCE,
  runCurve,
  runHostileBattery,
  withEventLoopLag,
} from './harness'

/**
 * Candidate B — `quickjs-emscripten`, in-process (no worker).
 *
 * `require`/`process`/`fetch` do not exist inside a QuickJS context at all —
 * they are ReferenceErrors, not just blocked. Because it runs on the main
 * thread, a long-running case is expected to show up as event loop lag —
 * that is exactly what this candidate is here to measure.
 */

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

function makeExecutor(module: QuickJSWASMModule): ExecuteCase {
  return ({ source, timeoutMs, memoryMb, input }) => {
    const start = performance.now()
    const runtime = module.newRuntime()
    try {
      runtime.setMemoryLimit(memoryMb * 1024 * 1024)
      const deadline = Date.now() + timeoutMs
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
      const context = runtime.newContext()
      try {
        // Route the call through a `.then`/`.catch` onto a global rather than
        // trusting the raw evalCode result: `solve` may return a Promise
        // (e.g. a stray dynamic `import()`), and evalCode never drains
        // microtasks on its own — an unresolved promise would silently read
        // back as "ok" with an empty value.
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
          return Promise.resolve<CaseResult>({
            outcome: classifyErrorMessage(detail),
            detail,
            ms: performance.now() - start,
          })
        }
        started.value.dispose()
        runtime.executePendingJobs()

        const settled = context.evalCode('JSON.stringify(globalThis.__settled)')
        const ms = performance.now() - start
        if (settled.error) {
          const detail = describeError(context, settled.error)
          return Promise.resolve<CaseResult>({ outcome: classifyErrorMessage(detail), detail, ms })
        }

        const raw = context.dump(settled.value) as string | undefined
        settled.value.dispose()
        if (raw === undefined) {
          return Promise.resolve<CaseResult>({
            outcome: 'blocked',
            detail: 'promise never settled within the deadline',
            ms,
          })
        }
        const parsed = JSON.parse(raw) as { ok: boolean; v?: unknown; e?: string }
        return Promise.resolve<CaseResult>(
          parsed.ok
            ? { outcome: 'ok', value: parsed.v, ms }
            : { outcome: 'blocked', detail: parsed.e, ms },
        )
      } finally {
        context.dispose()
      }
    } catch (cause) {
      const ms = performance.now() - start
      const detail = cause instanceof Error ? cause.message : String(cause)
      const outcome = /memory/i.test(detail) ? 'memory' : 'error'
      return Promise.resolve<CaseResult>({ outcome, detail, ms })
    } finally {
      runtime.dispose()
    }
  }
}

async function main(): Promise<void> {
  const timeoutMs = 2000
  const memoryMb = 64
  const coldStartAt = performance.now()
  const module = await newQuickJSWASMModule()
  const coldStartMs = performance.now() - coldStartAt

  const execute = makeExecutor(module)

  const { result: curves, lag: eventLoopLag } = await withEventLoopLag(() =>
    Promise.all(
      CASE_COUNTS.map((count) => runCurve(execute, REALISTIC_SOURCE, count, timeoutMs, memoryMb)),
    ),
  )

  const hostile = await runHostileBattery(execute, timeoutMs, memoryMb)

  printEngineReport({
    engine: 'quickjs-emscripten (in-process)',
    coldStartMs,
    curves,
    eventLoopLag,
    hostile,
    note: 'require/process/fetch are ReferenceErrors — not reachable at all, unlike worker_threads.',
  })
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  await main()
}
