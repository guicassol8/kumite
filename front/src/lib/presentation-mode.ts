/**
 * Whether the telão (presentation mode) is active, outside of React — a
 * module with subscribers, same shape as `theme.ts`. Header and footer read
 * this directly (via `usePresentationMode`) instead of a prop drilled down
 * from `leaderboard.tsx`, and it stays true even when `requestFullscreen`
 * never actually took effect (unsupported API, denied request): hiding
 * chrome and forcing dark must not depend on real fullscreen succeeding.
 */
let active = false

const listeners = new Set<() => void>()

export function isPresentationActive(): boolean {
  return active
}

export function setPresentationActive(value: boolean): void {
  if (active === value) return
  active = value
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
