// A counting semaphore for async work (#447): at most `limit` tasks run at
// once, the rest wait in FIFO order. Calls beyond the limit wait their turn,
// they are never refused.
//
// A free slot starts the task synchronously, in the caller's tick, and a
// finishing task hands its slot straight to the oldest waiter — so a
// newcomer can never overtake the queue between a release and the waiter's
// resumption.

export type SemaphoreLoad = { inFlight: number; waiting: number }

export type Semaphore = {
  /** Runs `task` once a slot is free; settles as the task does. */
  run: <T>(task: () => Promise<T>) => Promise<T>
  /** How many tasks hold a slot and how many wait for one. Read-only. */
  load: () => SemaphoreLoad
}

export function createSemaphore(limit: number): Semaphore {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`createSemaphore: limit must be a positive integer, got ${limit}`)
  }

  let inFlight = 0
  const waiting: Array<() => void> = []

  function release(): void {
    const next = waiting.shift()
    if (next) next()
    else inFlight--
  }

  // `await task()` inside the try also catches a task that throws
  // synchronously: the slot is released on every path.
  async function start<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task()
    } finally {
      release()
    }
  }

  function run<T>(task: () => Promise<T>): Promise<T> {
    if (inFlight < limit) {
      inFlight++
      return start(task)
    }
    return new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        start(task).then(resolve, reject)
      })
    })
  }

  return { run, load: () => ({ inFlight, waiting: waiting.length }) }
}
