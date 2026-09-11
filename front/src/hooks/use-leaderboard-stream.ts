import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { connectEventStream, type SseConnectionStatus } from '@/lib/sse-client'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'

import { useSession } from './use-session'

// How long the connection may stay shut before the screen admits it is not
// live. Longer than the client's own SSE_RETRY_DELAY_MS so an ordinary blip
// (drop + one successful retry) never flashes the "not live" badge.
export const OFFLINE_AFTER_MS = 6_000

type StreamData = {
  connectionStatus: SseConnectionStatus
  // Tracks round open/close independently of `round`: `ranking.updated` is
  // only re-published on submission-driven dirty ticks (#44), so opening a
  // round with zero submissions never refreshes `round` on its own — this
  // field lets the route fall back to a REST fetch for that round instead.
  activeRoundId: string | null
  closesAt: Date | null
  round: RoundRanking | null
  event: EventRanking | null
  serverTime: Date | null
}

export type LeaderboardStreamState = StreamData & {
  // `connectionStatus === 'open'`, named for what the route asks of it: the
  // REST fallback widens and starts polling exactly when this is false.
  isLive: boolean
  // True once the stream has been down for OFFLINE_AFTER_MS straight.
  isOffline: boolean
  // Tears the current connection down and opens a new one, without dropping
  // the ranking already on screen.
  reconnect: () => void
}

const INITIAL_STATE: StreamData = {
  connectionStatus: 'connecting',
  activeRoundId: null,
  closesAt: null,
  round: null,
  event: null,
  serverTime: null,
}

// Live scores for the /leaderboard screen, sourced from the /sse channel's
// `ranking.updated` event (#44). Only connects while authenticated — same
// gating as use-event-stream, and the same channel, so this hook and the
// home screen's each open their own connection independently.
// `onRoundChange` fires on round.opened/round.closed so the caller can
// invalidate the rounds list query — mirrors use-event-stream's callback,
// since `lastClosedRound` on the route is derived from that same list and
// would otherwise go stale until something else refetches it.
export function useLeaderboardStream(onRoundChange?: () => void): LeaderboardStreamState {
  const { status } = useSession()
  const [state, setState] = useState<StreamData>(INITIAL_STATE)
  const [connectionNonce, setConnectionNonce] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const onRoundChangeRef = useRef(onRoundChange)
  onRoundChangeRef.current = onRoundChange

  useEffect(() => {
    if (status !== 'authenticated') {
      setState(INITIAL_STATE)
      return
    }

    return connectEventStream(
      (event: SseEvent) => {
        switch (event.type) {
          case 'state.sync':
            setState((prev) => ({
              ...prev,
              activeRoundId: event.round?.id ?? null,
              closesAt: event.round?.closesAt ?? null,
            }))
            return
          case 'round.opened':
            setState((prev) => ({
              ...prev,
              activeRoundId: event.roundId,
              closesAt: event.closesAt,
              round: null,
            }))
            onRoundChangeRef.current?.()
            return
          case 'round.extended':
            setState((prev) =>
              prev.activeRoundId === event.roundId ? { ...prev, closesAt: event.closesAt } : prev,
            )
            return
          case 'round.closed':
            setState((prev) => ({ ...prev, activeRoundId: null, closesAt: null, round: null }))
            onRoundChangeRef.current?.()
            return
          case 'ranking.updated':
            setState((prev) => ({
              ...prev,
              activeRoundId: event.round?.roundId ?? null,
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
  }, [status, connectionNonce])

  const isLive = state.connectionStatus === 'open'

  // Deliberately keyed on `isLive`, not on `connectionStatus`: sse-client
  // republishes 'reconnecting' on every retry, so a status-keyed effect would
  // rearm this timeout every SSE_RETRY_DELAY_MS and a stream that never comes
  // back would never be reported offline.
  useEffect(() => {
    if (isLive) {
      setIsOffline(false)
      return
    }
    const id = setTimeout(() => setIsOffline(true), OFFLINE_AFTER_MS)
    return () => clearTimeout(id)
  }, [isLive])

  // Bumping the nonce re-runs the connect effect, which disconnects and
  // reopens. `state` is untouched on purpose — the last ranking has to
  // survive a manual retry (acceptance #5); only a logout resets it.
  const reconnect = useCallback(() => setConnectionNonce((nonce) => nonce + 1), [])

  return useMemo(
    () => ({ ...state, isLive, isOffline, reconnect }),
    [state, isLive, isOffline, reconnect],
  )
}
