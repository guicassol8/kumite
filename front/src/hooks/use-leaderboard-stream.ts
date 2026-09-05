import { useEffect, useState } from 'react'

import { connectEventStream, type SseConnectionStatus } from '@/lib/sse-client'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'

import { useSession } from './use-session'

export type LeaderboardStreamState = {
  connectionStatus: SseConnectionStatus
  round: RoundRanking | null
  event: EventRanking | null
  serverTime: Date | null
}

const INITIAL_STATE: LeaderboardStreamState = {
  connectionStatus: 'connecting',
  round: null,
  event: null,
  serverTime: null,
}

// Live scores for the /leaderboard screen, sourced from the /sse channel's
// `ranking.updated` event (#44). Only connects while authenticated — same
// gating as use-event-stream, and the same channel, so this hook and the
// home screen's each open their own connection independently.
export function useLeaderboardStream(): LeaderboardStreamState {
  const { status } = useSession()
  const [state, setState] = useState<LeaderboardStreamState>(INITIAL_STATE)

  useEffect(() => {
    if (status !== 'authenticated') {
      setState(INITIAL_STATE)
      return
    }

    return connectEventStream(
      (event: SseEvent) => {
        switch (event.type) {
          case 'ranking.updated':
            setState((prev) => ({
              ...prev,
              round: event.round,
              event: event.event,
              serverTime: event.serverTime,
            }))
            return
          case 'heartbeat':
            setState((prev) => ({ ...prev, serverTime: event.serverTime }))
        }
      },
      (connectionStatus) => setState((prev) => ({ ...prev, connectionStatus })),
    )
  }, [status])

  return state
}
