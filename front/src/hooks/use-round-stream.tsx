import { createContext, type ReactNode, useContext } from 'react'

import { type AppStreamState, type EventStreamState, useEventStream } from './use-event-stream'

const RoundStreamContext = createContext<AppStreamState | null>(null)

// The app's ONE `/sse` connection (#217, #274): `Header`, `Home`, the problem
// and round screens and the leaderboard all read from here, and a second
// connection per consumer would double the server load and the reconnect
// noise for no benefit — the stream carries no per-consumer state.
export function RoundStreamProvider({ children }: { children: ReactNode }) {
  const state = useEventStream()
  return <RoundStreamContext.Provider value={state}>{children}</RoundStreamContext.Provider>
}

/**
 * Shared by `useRoundStream` and `useLeaderboardStream`, which select
 * different slices of the same connection. `hookName` only shapes the error,
 * so a leaderboard screen mounted outside the provider is not told to go look
 * at a round hook it never called.
 */
export function useStreamContext(hookName: string): AppStreamState {
  const state = useContext(RoundStreamContext)
  if (state === null) {
    throw new Error(`${hookName} must be used within a RoundStreamProvider`)
  }
  return state
}

export function useRoundStream(): EventStreamState {
  return useStreamContext('useRoundStream')
}
