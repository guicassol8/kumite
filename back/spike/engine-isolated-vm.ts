import ivm from 'isolated-vm'

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
 * Candidate C — `isolated-vm@7`, native addon around a real V8 isolate.
 *
 * Per the plan's decision, a fresh `Isolate` per case (not a reused isolate
 * with a fresh context) — the heaviest-weight of the "fresh context per case"
 * readings, and the number this candidate is here to produce. Runs on
 * `engines: node >=24` (v7.0.1); the repo's CI pins Node 20 — that gap is
 * recorded verbatim in results.md and the ADR if this candidate wins.
 */

function classifyErrorMessage(message: string): CaseOutcome {
  if (/script execution timed out|timed out/i.test(message)) return 'timeout'
  if (/memory|allocation failed|isolate is disposed/i.test(message)) return 'memory'
  return 'blocked'
}

const executeInIsolatedVm: ExecuteCase = async ({ source, timeoutMs, memoryMb, input }) => {
  const start = performance.now()
  const isolate = new ivm.Isolate({ memoryLimit: memoryMb })
  try {
    const context = await isolate.createContext()
    const code = `${source}\nsolve(${JSON.stringify(input)})`
    const script = await isolate.compileScript(code)
    try {
      const value = await script.run(context, { timeout: timeoutMs, copy: true, promise: true })
      return { outcome: 'ok' as CaseOutcome, value, ms: performance.now() - start }
    } finally {
      script.release()
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return { outcome: classifyErrorMessage(detail), detail, ms: performance.now() - start }
  } finally {
    // A timeout or a hit memoryLimit already disposes the isolate for us —
    // disposing twice throws, so only clean up if it's still alive.
    if (!isolate.isDisposed) isolate.dispose()
  }
}

async function main(): Promise<void> {
  const timeoutMs = 2000
  const memoryMb = 64
  const coldStartAt = performance.now()
  await executeInIsolatedVm({
    source: 'function solve(input) { return 0 }',
    timeoutMs,
    memoryMb,
    input: [],
  })
  const coldStartMs = performance.now() - coldStartAt

  const { result: curves, lag: eventLoopLag } = await withEventLoopLag(() =>
    Promise.all(
      CASE_COUNTS.map((count) =>
        runCurve(executeInIsolatedVm, REALISTIC_SOURCE, count, timeoutMs, memoryMb),
      ),
    ),
  )

  const hostile = await runHostileBattery(executeInIsolatedVm, timeoutMs, memoryMb)

  printEngineReport({
    engine: 'isolated-vm (native, fresh Isolate per case)',
    coldStartMs,
    curves,
    eventLoopLag,
    hostile,
    note:
      `engines: node >=24 (v7.0.1) vs. Node 20 pinned in CI — a real portability cost if this wins ` +
      `(ran here on Node ${process.versions.node}; \`pnpm add\` timing and prebuild-vs-compile in results.md).`,
  })
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  await main()
}
