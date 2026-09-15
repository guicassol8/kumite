import { useSyncExternalStore } from 'react'

import { isPresentationActive, subscribe } from '@/lib/presentation-mode'

export function usePresentationMode(): boolean {
  return useSyncExternalStore(subscribe, isPresentationActive, () => false)
}
