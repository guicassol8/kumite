// Scheduling helpers for the load harness (#136). Pure apart from timers.

// Absorbs the float error in `i * f` (30 * 0.1 is 3.0000000000000004), so
// the boundary always falls on the same index.
const EPSILON = 1e-9

/**
 * Whether submission `i` (0-based, global across teams) is a bad one, for a
 * bad fraction `f`. Bad submissions are spread evenly and deterministically:
 * `i` is bad when floor((i+1)·f) > floor(i·f), so two runs with the same
 * config send the same sequence, and a run of n sends floor(n·f) bad ones.
 */
export function isBadAt(i: number, f: number): boolean {
  return Math.floor((i + 1) * f + EPSILON) > Math.floor(i * f + EPSILON)
}

/**
 * Maps `items` through `fn` with at most `limit` calls in flight, keeping the
 * input order. Every item settles before the first rejection (if any) is
 * rethrown, so a failed signup never leaves half the batch running unseen.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  const errors: unknown[] = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      try {
        results[index] = await fn(items[index] as T, index)
      } catch (error) {
        errors.push(error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  if (errors.length > 0) throw errors[0]
  return results
}

/** Waits `ms`, or less when `signal` aborts — never rejects. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })
}
