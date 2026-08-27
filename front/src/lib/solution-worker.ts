/** What the page sends into a worker: the generated source and one input. */
export type SolutionRequest = {
  code: string
  input: unknown
}

/** What comes back: the return value, or the message of whatever went wrong. */
export type SolutionResponse = { ok: true; value: unknown } | { ok: false; message: string }

/**
 * The slice of `Worker` the runner actually drives.
 *
 * Structural on purpose: it is the contract a fake in vitest implements, and
 * the real `Worker` satisfies it without a cast.
 */
export type SolutionWorker = {
  postMessage(request: SolutionRequest): void
  terminate(): void
  onmessage: ((event: MessageEvent<SolutionResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

/**
 * Spawns one worker for one example.
 *
 * Workers are never reused: `terminate()` is the only way to stop an infinite
 * loop, so a case that times out takes its worker down with it, and a case that
 * succeeded must not leave globals behind for the next one.
 *
 * The `new URL(..., import.meta.url)` form is what makes Vite emit the worker as
 * its own chunk — a bare string path would break in the production build.
 */
export function spawnSolutionWorker(): SolutionWorker {
  return new Worker(new URL('./solution-runner.worker.ts', import.meta.url), {
    type: 'module',
  })
}
