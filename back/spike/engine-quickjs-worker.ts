import { Worker } from 'node:worker_threads'

import {
  CASE_COUNTS,
  type CaseResult,
  type ExecuteCase,
  HOSTILE_SOURCES,
  printEngineReport,
  REALISTIC_SOURCE,
  runCurve,
  withEventLoopLag,
} from './harness'

/**
 * Candidate D — quickjs-emscripten's per-case isolation from candidate B,
 * relocated into a single long-lived `worker_thread` (resourceLimits as a
 * second barrier behind QuickJS's own memory/interrupt limits).
 *
 * The whole point of this candidate: does moving quickjs off the main thread
 * remove the event-loop lag candidate B showed? The lag is sampled on *this*
 * (main) thread while the worker runs — that's the number that answers it.
 */

type WorkerMessage = { type: 'ready' } | ({ type: 'result'; id: number } & CaseResult)

type PendingRequest = {
  resolve: (result: CaseResult) => void
  watchdog: ReturnType<typeof setTimeout>
}

function spawnWorker(memoryMb: number): { worker: Worker; ready: Promise<void> } {
  const worker = new Worker(new URL('./quickjs-worker-body.ts', import.meta.url), {
    resourceLimits: { maxOldGenerationSizeMb: memoryMb * 2 }, // second barrier, above QuickJS's own limit
  })
  const ready = new Promise<void>((resolve) => {
    worker.once('message', (msg: WorkerMessage) => {
      if (msg.type === 'ready') resolve()
    })
  })
  return { worker, ready }
}

/** One persistent worker per executor instance ("per submission"), respawned if it dies. */
function makeSubmissionExecutor(): ExecuteCase {
  let nextId = 0
  let current: { worker: Worker; ready: Promise<void> } | undefined
  const pending = new Map<number, PendingRequest>()

  function settleAllAsCrash(detail: string): void {
    for (const [id, req] of pending) {
      clearTimeout(req.watchdog)
      req.resolve({ outcome: 'error', detail, ms: 0 })
      pending.delete(id)
    }
  }

  function ensureWorker(memoryMb: number): { worker: Worker; ready: Promise<void> } {
    if (current) return current
    const spawned = spawnWorker(memoryMb)
    spawned.worker.on('message', (msg: WorkerMessage) => {
      if (msg.type !== 'result') return
      const req = pending.get(msg.id)
      if (!req) return
      clearTimeout(req.watchdog)
      pending.delete(msg.id)
      const { id, type, ...result } = msg
      req.resolve(result)
    })
    spawned.worker.on('error', (err) => {
      settleAllAsCrash(`worker crashed: ${err.message}`)
      current = undefined
    })
    spawned.worker.on('exit', (code) => {
      if (code !== 0) settleAllAsCrash(`worker exited with code ${code}`)
      current = undefined
    })
    current = spawned
    return spawned
  }

  const execute: ExecuteCase = async ({ source, timeoutMs, memoryMb, input }) => {
    const { worker, ready } = ensureWorker(memoryMb)
    await ready
    const id = nextId++
    return new Promise<CaseResult>((resolve) => {
      const watchdog = setTimeout(() => {
        pending.delete(id)
        resolve({ outcome: 'timeout', detail: 'no reply from worker (watchdog)', ms: timeoutMs })
      }, timeoutMs + 500)
      pending.set(id, { resolve, watchdog })
      worker.postMessage({ id, source, timeoutMs, memoryMb, input })
    })
  }

  return execute
}

async function main(): Promise<void> {
  const timeoutMs = 2000
  const memoryMb = 64
  const execute = makeSubmissionExecutor()

  const coldStartAt = performance.now()
  await execute({ source: 'function solve(input) { return 0 }', timeoutMs, memoryMb, input: [] })
  const coldStartMs = performance.now() - coldStartAt

  const { result: curves, lag: eventLoopLag } = await withEventLoopLag(() =>
    Promise.all(
      CASE_COUNTS.map((count) => runCurve(execute, REALISTIC_SOURCE, count, timeoutMs, memoryMb)),
    ),
  )

  // Sequential, not runHostileBattery's Promise.all: a single worker is one
  // JS thread — the infinite-loop probe alone blocks it for ~timeoutMs, so
  // firing all six at once just races everything else against that probe's
  // watchdog. Sequential is what a single "submission" worker actually does.
  const hostile: Record<string, CaseResult> = {}
  for (const [name, source] of Object.entries(HOSTILE_SOURCES)) {
    hostile[name] = await execute({ source, timeoutMs, memoryMb, input: [] })
  }

  printEngineReport({
    engine: 'quickjs-emscripten inside worker_thread',
    coldStartMs,
    curves,
    eventLoopLag,
    hostile,
    note:
      'eventLoopLag near 0 vs. candidate B — the worker does what it is for. But the memory bomb misses ' +
      'its own 2s budget here: a standalone check (same setMemoryLimit/resourceLimits) measured ~3.85s to ' +
      'trip inside the worker vs. a few ms in-process (T3), and the worker exits (code 1) right after — ' +
      'so a memory-limit hit needs a respawn, not just the next case, unlike candidate B.',
  })
  process.exit(0)
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  await main()
}
