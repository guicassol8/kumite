// Bounded in-memory rings for the process's own instrumentation (#137,
// #138): the judge's runs and the SSE emissions and connects, read by
// GET /organizer/stats/process. Process-local and never persisted, like the
// live card's counters.

/**
 * Appends `item` and drops the oldest entries past `keep`, in place. Oldest
 * first, so a reader filtering by `endedAt` sees them in order.
 */
export function pushBounded<T>(ring: T[], item: T, keep: number): void {
  ring.push(item)
  if (ring.length > keep) ring.splice(0, ring.length - keep)
}

/** The entries that ended at or after `since` (epoch ms); every one without it. */
export function endedSince<T extends { endedAt: number }>(ring: readonly T[], since?: number): T[] {
  return since === undefined ? [...ring] : ring.filter((entry) => entry.endedAt >= since)
}
