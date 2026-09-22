import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { connectEventStream, type SseConnectionStatus } from '@/lib/sse-client'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'

import { useSession } from './use-session'

// How long the connection may stay shut before the leaderboard admits it is
// not live. Longer than the client's own SSE_RETRY_DELAY_MS so an ordinary
// blip (drop + one successful retry) never flashes the "not live" badge.
export const OFFLINE_AFTER_MS = 6_000

export type EventStreamState = {
  currentRoundId: string | null
  closesAt: Date | null
  serverTime: Date | null
  status: SseConnectionStatus
  roundChangedAt: Date | null
  rankingUpdatedAt: Date | null
}

type LeaderboardStreamData = {
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

export type LeaderboardStreamState = LeaderboardStreamData & {
  // `connectionStatus === 'open'`, named for what the route asks of it: the
  // REST fallback widens and starts polling exactly when this is false.
  isLive: boolean
  // True once the stream has been down for OFFLINE_AFTER_MS straight.
  isOffline: boolean
  // Tears the current connection down and opens a new one, without dropping
  // the ranking already on screen.
  reconnect: () => void
}

/**
 * Everything one `/sse` connection feeds, in one object: the round state at
 * the top level and the leaderboard's own state under `leaderboard` (#274).
 */
export type AppStreamState = EventStreamState & { leaderboard: LeaderboardStreamState }

const INITIAL_STATE: EventStreamState = {
  currentRoundId: null,
  closesAt: null,
  serverTime: null,
  status: 'connecting',
  roundChangedAt: null,
  rankingUpdatedAt: null,
}

const INITIAL_LEADERBOARD: LeaderboardStreamData = {
  connectionStatus: 'connecting',
  activeRoundId: null,
  closesAt: null,
  round: null,
  event: null,
  serverTime: null,
}

// The app's single `/sse` connection (#274), mounted once by
// `RoundStreamProvider`. Only connects while authenticated — there's nothing
// to stream to an anonymous visitor, and the endpoint requires a token anyway.
//
// TWO INDEPENDENT REDUCERS over that one connection, deliberately not merged:
// the leaderboard's reducer rewrites `activeRoundId` from
// `ranking.updated.round`, and folding that into the round reducer's
// `currentRoundId` would blank the Header's current round during the window
// where `announceClosedRounds` holds `round.closed` back for judging (#176).
// They answer different questions and are allowed to disagree; what they share
// is the socket, not the state.
//
// `onRoundChange` fires on round.opened/round.closed so the caller can
// invalidate the closed-rounds list query; round.extended only moves
// closesAt on the round already tracked, no list refetch needed.
// `onRankingUpdate` fires on ranking.updated — published on every judged
// submission (debounced, #44) — as a plain "something scored" signal: the
// payload isn't read here, callers just refetch what they own (#54).
export function useEventStream(
  onRoundChange?: () => void,
  onRankingUpdate?: () => void,
): AppStreamState {
  const { status, user } = useSession()
  // A `/sse` 403 is terminal on purpose (#189): on that route it is only ever
  // `requirePasswordUpToDate`, so retrying would answer the same 403 and
  // dropping the session would take away the screen that fixes it. That makes
  // this effect the only thing that can revive the stream — and changing the
  // password does not touch `status`, so without this dep the stream would
  // stay dead for the rest of the page's life. The boolean, not `user`:
  // `refreshSession` hands back a fresh object on every call and a healthy
  // stream must survive that.
  const mustChangePassword = user?.mustChangePassword === true
  const [state, setState] = useState<EventStreamState>(INITIAL_STATE)
  const [leaderboardState, setLeaderboardState] =
    useState<LeaderboardStreamData>(INITIAL_LEADERBOARD)
  const [connectionNonce, setConnectionNonce] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const onRoundChangeRef = useRef(onRoundChange)
  onRoundChangeRef.current = onRoundChange
  const onRankingUpdateRef = useRef(onRankingUpdate)
  onRankingUpdateRef.current = onRankingUpdate

  useEffect(() => {
    if (status !== 'authenticated') {
      setState(INITIAL_STATE)
      setLeaderboardState(INITIAL_LEADERBOARD)
      return
    }

    return connectEventStream(
      (event: SseEvent) => {
        reduceRound(event)
        reduceLeaderboard(event)
      },
      (connectionStatus) => {
        setState((prev) => ({ ...prev, status: connectionStatus }))
        setLeaderboardState((prev) => ({ ...prev, connectionStatus }))
      },
    )

    function reduceRound(event: SseEvent) {
      switch (event.type) {
        case 'state.sync':
          setState((prev) => ({
            ...prev,
            currentRoundId: event.round?.id ?? null,
            closesAt: event.round?.closesAt ?? null,
            serverTime: event.serverTime,
          }))
          return
        case 'round.opened':
          setState((prev) => ({
            ...prev,
            currentRoundId: event.roundId,
            closesAt: event.closesAt,
            serverTime: event.serverTime,
            roundChangedAt: event.serverTime,
          }))
          onRoundChangeRef.current?.()
          return
        case 'round.extended':
          setState((prev) =>
            prev.currentRoundId === event.roundId
              ? { ...prev, closesAt: event.closesAt, serverTime: event.serverTime }
              : prev,
          )
          return
        case 'round.closed':
          // `roundChangedAt` advances on EVERY close, matching
          // `onRoundChange` right below it, while the rest of the state
          // stays keyed on the id (#274). Screens derive their invalidation
          // from this timestamp, so the two must not disagree: while
          // `announceClosedRounds` holds a close back for judging (#176), a
          // client that connected inside that window received
          // `state.sync` with `round: null` and then this event for a round
          // it never tracked — under the id check it would refresh nothing.
          setState((prev) =>
            prev.currentRoundId === event.roundId
              ? {
                  ...prev,
                  currentRoundId: null,
                  closesAt: null,
                  serverTime: event.serverTime,
                  roundChangedAt: event.serverTime,
                }
              : { ...prev, roundChangedAt: event.serverTime },
          )
          onRoundChangeRef.current?.()
          return
        case 'ranking.updated':
          setState((prev) => ({ ...prev, rankingUpdatedAt: event.serverTime }))
          onRankingUpdateRef.current?.()
          return
        case 'heartbeat':
          setState((prev) => ({ ...prev, serverTime: event.serverTime }))
      }
    }

    function reduceLeaderboard(event: SseEvent) {
      switch (event.type) {
        case 'state.sync':
          setLeaderboardState((prev) => ({
            ...prev,
            activeRoundId: event.round?.id ?? null,
            closesAt: event.round?.closesAt ?? null,
          }))
          return
        case 'round.opened':
          setLeaderboardState((prev) => ({
            ...prev,
            activeRoundId: event.roundId,
            closesAt: event.closesAt,
            round: null,
          }))
          return
        case 'round.extended':
          setLeaderboardState((prev) =>
            prev.activeRoundId === event.roundId ? { ...prev, closesAt: event.closesAt } : prev,
          )
          return
        case 'round.closed':
          setLeaderboardState((prev) => ({
            ...prev,
            activeRoundId: null,
            closesAt: null,
            round: null,
          }))
          return
        case 'ranking.updated':
          setLeaderboardState((prev) => ({
            ...prev,
            activeRoundId: event.round?.roundId ?? null,
            round: event.round,
            event: event.event,
            serverTime: event.serverTime,
          }))
          return
        case 'heartbeat':
          setLeaderboardState((prev) => ({ ...prev, serverTime: event.serverTime }))
      }
    }
  }, [status, connectionNonce, mustChangePassword])

  const isLive = leaderboardState.connectionStatus === 'open'

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
  // reopens. State is untouched on purpose — the last ranking has to
  // survive a manual retry (#44 acceptance #5); only a logout resets it.
  const reconnect = useCallback(() => setConnectionNonce((nonce) => nonce + 1), [])

  const leaderboard = useMemo(
    () => ({ ...leaderboardState, isLive, isOffline, reconnect }),
    [leaderboardState, isLive, isOffline, reconnect],
  )

  return useMemo(() => ({ ...state, leaderboard }), [state, leaderboard])
}
