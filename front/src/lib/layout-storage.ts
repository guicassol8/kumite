import type { LayoutStorage } from 'react-resizable-panels'

// One participant preference, not one per problem — the key never carries a
// problem id, unlike `workspace-storage.ts`'s per-problem keys.
const KEY_PREFIX = 'kumite:problem-layout:'

/**
 * `useDefaultLayout`'s storage port, backed by `localStorage` the same
 * defensive way as `workspace-storage.ts`: a private tab or a disabled store
 * throws instead of losing the layout, so both methods swallow it — losing
 * the preference is fine, losing the screen is not.
 */
export const layoutStorage: LayoutStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(`${KEY_PREFIX}${key}`)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(`${KEY_PREFIX}${key}`, value)
    } catch {
      // best-effort, see getItem
    }
  },
}
