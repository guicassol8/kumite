import { useEffect, useRef, useState } from 'react'

import { connectEventStream, type SseConnectionStatus } from '@/lib/sse-client'
import type { SseEvent } from '@/lib/sse-schema'

import { useSession } from './use-session'

export type EventStreamState = {
  currentRoundId: string | null
  closesAt: Date | null
  serverTime: Date | null
  status: SseConnectionStatus
  roundChangedAt: Date | null
  rankingUpdatedAt: Date | null
}

const INITIAL_STATE: EventStreamState = {
  currentRoundId: null,
  closesAt: null,
  serverTime: null,
  status: 'connecting',
  roundChangedAt: null,
  rankingUpdatedAt: null,
}

// Live current-round state for the home screen, sourced from the /sse
// channel (#38). Only connects while authenticated — there's nothing to
// stream to an anonymous visitor, and the endpoint requires a token anyway.
// `onRoundChange` fires on round.opened/round.closed so the caller can
// invalidate the closed-rounds list query; round.extended only moves
// closesAt on the round already tracked, no list refetch needed.
// `onRankingUpdate` fires on ranking.updated — published on every judged
// submission (debounced, #44) — as a plain "something scored" signal: the
// payload isn't read here, callers just refetch what they own (#54).
export function useEventStream(
  onRoundChange?: () => void,
  onRankingUpdate?: () => void,
): EventStreamState {
  const { status } = useSession()
  const [state, setState] = useState<EventStreamState>(INITIAL_STATE)
  const onRoundChangeRef = useRef(onRoundChange)
  onRoundChangeRef.current = onRoundChange
  const onRankingUpdateRef = useRef(onRankingUpdate)
  onRankingUpdateRef.current = onRankingUpdate

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
            setState((prev) =>
              prev.currentRoundId === event.roundId
                ? {
                    ...prev,
                    currentRoundId: null,
                    closesAt: null,
                    serverTime: event.serverTime,
                    roundChangedAt: event.serverTime,
                  }
                : prev,
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
      },
      (status) => setState((prev) => ({ ...prev, status })),
    )
  }, [status])

  return state
}
