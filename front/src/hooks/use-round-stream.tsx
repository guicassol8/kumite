import { createContext, type ReactNode, useContext } from 'react'

import { type EventStreamState, useEventStream } from './use-event-stream'

const RoundStreamContext = createContext<EventStreamState | null>(null)

// One `useEventStream()` connection for the whole app (#217): `Header` and
// `Home` both need the live round, and a second SSE connection per consumer
// would double the server load and the reconnect noise for no benefit — the
// stream carries no per-consumer state.
export function RoundStreamProvider({ children }: { children: ReactNode }) {
  const state = useEventStream()
  return <RoundStreamContext.Provider value={state}>{children}</RoundStreamContext.Provider>
}

export function useRoundStream(): EventStreamState {
  const state = useContext(RoundStreamContext)
  if (state === null) {
    throw new Error('useRoundStream must be used within a RoundStreamProvider')
  }
  return state
}
