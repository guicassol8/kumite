import { useSyncExternalStore } from 'react'

/**
 * The one breakpoint between the phone and the rest: `size.breakpoint-cards`
 * (768px, `docs/design/tokens/kumite.tokens.json`), Tailwind's `md`. Below it
 * `/problem/$id` stacks its column and the editor gets the phone's controls
 * (#199); from it up, the resizable panels of #203.
 */
export const DESKTOP_QUERY = '(min-width: 768px)'

// Same defensive posture as `workspace-storage.ts` and the i18n
// `localStorageSafe`: an environment without `matchMedia` reports "no match"
// instead of throwing.
function getSnapshot(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(query).matches
}

function subscribe(query: string, onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mediaQueryList = window.matchMedia(query)
  mediaQueryList.addEventListener('change', onStoreChange)
  return () => mediaQueryList.removeEventListener('change', onStoreChange)
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => getSnapshot(query),
    () => false,
  )
}
