import { isMainThread, parentPort } from 'node:worker_threads'

/**
 * Test-only worker double for judge.service.ts's runJudgeAgainstWorker()
 * seam — speaks the same {id, input} -> {type:'result', id, outcome,
 * value, ms} protocol as sandbox-engine.worker.ts, but deterministically:
 * echoes `input` back as `value` with outcome 'ok', or calls process.exit()
 * when input is '__crash__' to simulate the worker dying mid-submission.
 * Plain JS (not TS) so it needs no pretest build step, same reasoning as
 * sandbox-engine.worker.ts's own precompiled dist file.
 */
if (!isMainThread) {
  parentPort?.on('message', (request) => {
    if (request.input === '__crash__') {
      process.exit(1)
    }
    parentPort?.postMessage({ type: 'result', id: request.id, outcome: 'ok', value: request.input, ms: 0 })
  })
}
