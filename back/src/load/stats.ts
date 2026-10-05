// Descriptive statistics for the load report (#136). Pure, no I/O.

export type Summary = {
  count: number
  min: number | null
  p50: number | null
  p95: number | null
  p99: number | null
  max: number | null
  mean: number | null
}

/**
 * Nearest-rank percentile of an ascending list: the smallest value with at
 * least p% of the list at or below it. Null on an empty list, so the report
 * shows "—" instead of a made-up zero.
 */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[Math.min(sorted.length, rank) - 1] ?? null
}

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) {
    return { count: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null }
  }
  const sorted = [...values].sort((a, b) => a - b)
  let total = 0
  for (const value of sorted) total += value
  return {
    count: sorted.length,
    min: sorted[0] ?? null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.at(-1) ?? null,
    mean: total / sorted.length,
  }
}

/** Largest value, or null on an empty list. */
export function maxOf(values: readonly number[]): number | null {
  let max: number | null = null
  for (const value of values) if (max === null || value > max) max = value
  return max
}

/** Arithmetic mean, or null on an empty list. */
export function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  let total = 0
  for (const value of values) total += value
  return total / values.length
}
