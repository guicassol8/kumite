import { Worker } from 'node:worker_threads'

import {
  CASE_COUNTS,
  type CaseResult,
  type ExecuteCase,
  printEngineReport,
  REALISTIC_SOURCE,
  runCurve,
  runHostileBattery,
  withEventLoopLag,
} from './harness'

/**
 * Candidate A — one `Worker` per case, hard-terminated on timeout.
 *
 * `require`/`process`/`fetch` are all still reachable inside the worker: it
 * isolates the event loop and the heap, not the Node API surface. That is the
 * weak point recorded in results.md.
 */

const workerBody = `
const { parentPort, workerData } = require('node:worker_threads')
try {
  const fn = new Function(\`\${workerData.source}\nreturn solve(workerData_input)\`)
  const value = fn.call(undefined)
  parentPort.postMessage({ ok: true, value })
} catch (cause) {
  parentPort.postMessage({ ok: false, detail: cause instanceof Error ? cause.message : String(cause) })
}
`

const executeInWorker: ExecuteCase = ({ source, timeoutMs, memoryMb, input }) =>
  new Promise<CaseResult>((resolve) => {
    const start = performance.now()
    const worker = new Worker(`const workerData_input = ${JSON.stringify(input)};\n${workerBody}`, {
      eval: true,
      workerData: { source },
      resourceLimits: { maxOldGenerationSizeMb: memoryMb },
    })

    let settled = false
    const finish = (result: CaseResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        outcome: 'timeout',
        detail: `exceeded ${timeoutMs}ms`,
        ms: performance.now() - start,
      })
    }, timeoutMs)

    worker.once('message', (msg: { ok: boolean; value?: unknown; detail?: string }) => {
      const ms = performance.now() - start
      if (msg.ok) {
        finish({ outcome: 'ok', value: msg.value, ms })
      } else {
        finish({ outcome: 'error', detail: msg.detail, ms })
      }
    })

    worker.once('error', (err) => {
      const ms = performance.now() - start
      const detail = err.message
      const outcome = /memory|heap|allocation/i.test(detail) ? 'memory' : 'error'
      finish({ outcome, detail, ms })
    })

    worker.once('exit', (code) => {
      // No 'message' arrived before the worker died: either process.exit()
      // ran (code often 0) or an uncaught crash (nonzero) — either way the
      // case never produced a result, which is itself the finding.
      if (!settled) {
        finish({
          outcome: 'blocked',
          detail: `worker exited (code ${code}) without a result — likely process.exit()`,
          ms: performance.now() - start,
        })
      }
    })
  })

async function main(): Promise<void> {
  const timeoutMs = 2000
  const memoryMb = 64
  const coldStartAt = performance.now()
  // Prime one throwaway worker so cold-start reflects first-Worker overhead,
  // not the whole process's V8 warmup.
  await executeInWorker({
    source: 'function solve(input) { return 0 }',
    timeoutMs,
    memoryMb,
    input: [],
  })
  const coldStartMs = performance.now() - coldStartAt

  const { result: curves, lag: eventLoopLag } = await withEventLoopLag(() =>
    Promise.all(
      CASE_COUNTS.map((count) =>
        runCurve(executeInWorker, REALISTIC_SOURCE, count, timeoutMs, memoryMb),
      ),
    ),
  )

  const hostile = await runHostileBattery(executeInWorker, timeoutMs, memoryMb)

  printEngineReport({
    engine: 'worker_threads',
    coldStartMs,
    curves,
    eventLoopLag,
    hostile,
    note: 'require/process/fetch remain reachable inside the worker — isolates heap+event-loop, not the API surface.',
  })
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  await main()
}
