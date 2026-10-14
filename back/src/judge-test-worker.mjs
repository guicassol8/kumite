import { BroadcastChannel, isMainThread, parentPort } from 'node:worker_threads'

/**
 * Test-only worker double for judge.service.ts's runJudgeAgainstWorker()
 * seam — speaks the same {id, input} -> {type:'result', id, outcome,
 * value, ms} protocol as sandbox-engine.worker.ts, but deterministically,
 * with outcome 'ok' and ms 0 unless it crashes:
 * - input '__crash__': calls process.exit() to simulate the worker dying
 *   mid-submission;
 * - input '__hang__' (#277): never replies, so the judge's watchdog fires;
 * - input '__memory__' / '__error__' (#277): replies with that sandbox
 *   outcome, as QuickJS running out of memory or a host-side failure would;
 * - input '__die_idle__' (#277): echoed back like any other, then the worker
 *   throws an uncaught error a moment later — while it sits idle in the pool;
 * - input { barrier, waitMs } (#294): meets another worker at a barrier —
 *   opens the BroadcastChannel named `barrier` and announces itself; value
 *   'together' if a peer shows up (it answers an arrival, so whichever
 *   worker comes second is heard too), 'alone' if none does within waitMs.
 *   The channel closes before the reply, so a submission served only after
 *   that reply (a serialized judge, on this same pooled worker or another)
 *   never meets this one;
 * - any other input: echoed back as `value`.
 * Plain JS (not TS) so it needs no pretest build step, same reasoning as
 * sandbox-engine.worker.ts's own precompiled dist file.
 */
function meetAtBarrier(barrier, waitMs) {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(barrier)
    const finish = (value) => {
      clearTimeout(timer)
      channel.close()
      resolve(value)
    }
    const timer = setTimeout(() => finish('alone'), waitMs)
    channel.onmessage = (event) => {
      if (event.data === 'arrive') channel.postMessage('here')
      finish('together')
    }
    channel.postMessage('arrive')
  })
}

function isBarrier(input) {
  return typeof input === 'object' && input !== null && typeof input.barrier === 'string'
}

if (!isMainThread) {
  parentPort?.on('message', async (request) => {
    if (request.input === '__crash__') {
      process.exit(1)
    }
    if (request.input === '__hang__') return
    if (request.input === '__die_idle__') {
      setTimeout(() => {
        throw new Error('idle worker crash')
      }, 200)
    }
    if (request.input === '__memory__' || request.input === '__error__') {
      const outcome = request.input === '__memory__' ? 'memory' : 'error'
      parentPort?.postMessage({ type: 'result', id: request.id, outcome, detail: outcome, ms: 0 })
      return
    }
    const value = isBarrier(request.input)
      ? await meetAtBarrier(request.input.barrier, request.input.waitMs)
      : request.input
    parentPort?.postMessage({ type: 'result', id: request.id, outcome: 'ok', value, ms: 0 })
  })
}
