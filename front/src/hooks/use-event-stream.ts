import { useEffect, useRef, useState } from 'react'

import { connectEventStream } from '@/lib/sse-client'
import type { SseEvent } from '@/lib/sse-schema'

import { useSession } from './use-session'

export type EventStreamState = {
  currentRoundId: string | null
  closesAt: Date | null
  serverTime: Date | null
}

const INITIAL_STATE: EventStreamState = { currentRoundId: null, closesAt: null, serverTime: null }

// Live current-round state for the home screen, sourced from the /sse
// channel (#38). Only connects while authenticated — there's nothing to
// stream to an anonymous visitor, and the endpoint requires a token anyway.
// `onRoundChange` fires on round.opened/round.closed so the caller can
// invalidate the closed-rounds list query; round.extended only moves
// closesAt on the round already tracked, no list refetch needed.
export function useEventStream(onRoundChange?: () => void): EventStreamState {
  const { status } = useSession()
  const [state, setState] = useState<EventStreamState>(INITIAL_STATE)
  const onRoundChangeRef = useRef(onRoundChange)
  onRoundChangeRef.current = onRoundChange

  useEffect(() => {
    if (status !== 'authenticated') {
      setState(INITIAL_STATE)
      return
    }

    return connectEventStream((event: SseEvent) => {
      switch (event.type) {
        case 'state.sync':
          setState({
            currentRoundId: event.round?.id ?? null,
            closesAt: event.round?.closesAt ?? null,
            serverTime: event.serverTime,
          })
          return
        case 'round.opened':
          setState({
            currentRoundId: event.roundId,
            closesAt: event.closesAt,
            serverTime: event.serverTime,
          })
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
              ? { currentRoundId: null, closesAt: null, serverTime: event.serverTime }
              : prev,
          )
          onRoundChangeRef.current?.()
          return
        case 'heartbeat':
          setState((prev) => ({ ...prev, serverTime: event.serverTime }))
      }
    })
  }, [status])

  return state
}
