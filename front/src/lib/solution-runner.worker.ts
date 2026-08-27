import { executeSolution } from './execute-solution'
import type { SolutionRequest, SolutionResponse } from './solution-worker'

// The project compiles against the DOM lib, where `self` is a `Window` and the
// global `postMessage` wants a target origin. Narrowing to the two members a
// dedicated worker really exposes is cheaper than pulling the webworker lib
// into the whole program.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SolutionRequest>) => void) | null
  postMessage(response: SolutionResponse): void
}

worker.onmessage = (event) => {
  const { code, input } = event.data
  let response: SolutionResponse

  try {
    response = { ok: true, value: executeSolution(code, input) }
  } catch (error) {
    response = { ok: false, message: error instanceof Error ? error.message : String(error) }
  }

  try {
    worker.postMessage(response)
  } catch (error) {
    // The return value survived `solve` but not the structured clone. The
    // curated toolbox cannot build such a value today, so the browser's own
    // DataCloneError message is the most informative thing to forward.
    worker.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
