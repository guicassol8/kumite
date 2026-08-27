/**
 * Strict structural equality for comparing a solution's return value with the
 * `expected` of an example.
 *
 * Deliberately unforgiving: `6` is not `"6"` and `null` is not `undefined`, so
 * a participant whose blocks build a string never sees a ✓ the judge would
 * later refuse. Arrays compare by order, plain objects by key set — the shapes
 * the curated toolbox can actually produce.
 *
 * When the server-side judge lands (#20/#21) it has to agree with this
 * function, or Executar and Submeter disagree on the same solution.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // `Object.is` settles the primitives and gets `NaN === NaN` for free; the
  // one place it is too strict is `-0`, which no participant means to
  // distinguish from `0`.
  if (Object.is(a, b)) return true
  if (a === 0 && b === 0) return true

  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false

  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
}
