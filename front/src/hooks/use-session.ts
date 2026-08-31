import { useSyncExternalStore } from 'react'

import { getState, subscribe } from '@/lib/session'

export function useSession() {
  const state = useSyncExternalStore(subscribe, getState)
  return { status: state.status, user: state.user }
}
