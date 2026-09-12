import { useSyncExternalStore } from 'react'

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
