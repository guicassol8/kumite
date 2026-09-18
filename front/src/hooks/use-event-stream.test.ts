import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseConnectionStatus } from '@/lib/sse-client'
import type { SseEvent } from '@/lib/sse-schema'

import { useEventStream } from './use-event-stream'

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function emit(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

const unsubscribe = vi.fn()

beforeEach(() => {
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(unsubscribe)
  unsubscribe.mockClear()
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('useEventStream', () => {
  it('does not connect while anonymous', () => {
    clearSession('manual')
    renderHook(() => useEventStream())
    expect(connectEventStream).not.toHaveBeenCalled()
  })

  it('connects once authenticated and applies state.sync', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useEventStream())

    expect(connectEventStream).toHaveBeenCalledTimes(1)
    const serverTime = new Date('2026-09-02T12:00:00.000Z')
    emit({
      type: 'state.sync',
      serverTime,
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })

    // Since #274 the same connection also feeds the leaderboard's reducer,
    // exposed under `leaderboard` — split off here so the round slice can
    // still be asserted exactly.
    const { leaderboard, ...round } = result.current
    expect(round).toEqual({
      currentRoundId: 'r1',
      closesAt: new Date('2026-09-02T12:30:00.000Z'),
      serverTime,
      status: 'connecting',
      roundChangedAt: null,
      rankingUpdatedAt: null,
    })
    expect(leaderboard.activeRoundId).toBe('r1')
  })

  it('round.opened sets the current round and calls onRoundChange', () => {
    setSession(fakeUser, 'tok-1')
    const onRoundChange = vi.fn()
    const { result } = renderHook(() => useEventStream(onRoundChange))

    emit({
      type: 'round.opened',
      serverTime: new Date('2026-09-02T12:00:00.000Z'),
      roundId: 'r2',
      closesAt: new Date('2026-09-02T12:45:00.000Z'),
    })

    expect(result.current.currentRoundId).toBe('r2')
    expect(onRoundChange).toHaveBeenCalledTimes(1)
  })

  it('round.closed for the tracked round clears it and calls onRoundChange', () => {
    setSession(fakeUser, 'tok-1')
    const onRoundChange = vi.fn()
    const { result } = renderHook(() => useEventStream(onRoundChange))

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r3',
      closesAt: new Date(),
    })
    emit({ type: 'round.closed', serverTime: new Date('2026-09-02T13:00:00.000Z'), roundId: 'r3' })

    expect(result.current.currentRoundId).toBeNull()
    expect(result.current.closesAt).toBeNull()
    expect(onRoundChange).toHaveBeenCalledTimes(2)
  })

  it('round.closed for a different round is ignored', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useEventStream())

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r4',
      closesAt: new Date('2026-09-02T12:45:00.000Z'),
    })
    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'other-round' })

    expect(result.current.currentRoundId).toBe('r4')
  })

  // #274: `roundChangedAt` is the provider's equivalent of the `onRoundChange`
  // callback, and screens now derive their invalidation from it. The callback
  // has always fired on every round.closed, so the timestamp has to move on
  // every round.closed too — the two disagreeing is a silent regression in the
  // window where `announceClosedRounds` holds a close back (up to
  // JUDGE_TIMEOUT_MS + 10s, #176): a client that connects inside it gets
  // `state.sync` with `round: null` and then a `round.closed` whose id matches
  // nothing it is tracking.
  it('round.closed for a different round still advances roundChangedAt', () => {
    setSession(fakeUser, 'tok-1')
    const onRoundChange = vi.fn()
    const { result } = renderHook(() => useEventStream(onRoundChange))

    const openedAt = new Date('2026-09-02T12:00:00.000Z')
    emit({
      type: 'round.opened',
      serverTime: openedAt,
      roundId: 'r4',
      closesAt: new Date('2026-09-02T12:45:00.000Z'),
    })
    onRoundChange.mockClear()

    const closedAt = new Date('2026-09-02T12:10:00.000Z')
    emit({ type: 'round.closed', serverTime: closedAt, roundId: 'other-round' })

    expect(result.current.roundChangedAt).toEqual(closedAt)
    expect(onRoundChange).toHaveBeenCalledTimes(1)
    // The rest of the round state stays keyed on the id, as before.
    expect(result.current.currentRoundId).toBe('r4')
    expect(result.current.closesAt).toEqual(new Date('2026-09-02T12:45:00.000Z'))
  })

  it('round.extended updates closesAt on the tracked round without invalidating', () => {
    setSession(fakeUser, 'tok-1')
    const onRoundChange = vi.fn()
    const { result } = renderHook(() => useEventStream(onRoundChange))

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r5',
      closesAt: new Date('2026-09-02T12:30:00.000Z'),
    })
    onRoundChange.mockClear()
    const extendedClosesAt = new Date('2026-09-02T12:40:00.000Z')
    emit({
      type: 'round.extended',
      serverTime: new Date(),
      roundId: 'r5',
      closesAt: extendedClosesAt,
    })

    expect(result.current.closesAt).toEqual(extendedClosesAt)
    expect(onRoundChange).not.toHaveBeenCalled()
  })

  it('ranking.updated calls onRankingUpdate without touching round state', () => {
    setSession(fakeUser, 'tok-1')
    const onRoundChange = vi.fn()
    const onRankingUpdate = vi.fn()
    const { result } = renderHook(() => useEventStream(onRoundChange, onRankingUpdate))

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r6',
      closesAt: new Date('2026-09-02T12:30:00.000Z'),
    })
    emit({
      type: 'ranking.updated',
      serverTime: new Date('2026-09-02T12:05:00.000Z'),
      round: null,
      event: { teams: [] },
    })

    expect(onRankingUpdate).toHaveBeenCalledTimes(1)
    expect(onRoundChange).toHaveBeenCalledTimes(1)
    expect(result.current.currentRoundId).toBe('r6')
  })

  it('does not call onRankingUpdate on a heartbeat', () => {
    setSession(fakeUser, 'tok-1')
    const onRankingUpdate = vi.fn()
    renderHook(() => useEventStream(undefined, onRankingUpdate))

    emit({ type: 'heartbeat', serverTime: new Date('2026-09-02T12:10:00.000Z') })

    expect(onRankingUpdate).not.toHaveBeenCalled()
  })

  it('disconnects on unmount', () => {
    setSession(fakeUser, 'tok-1')
    const { unmount } = renderHook(() => useEventStream())

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('roundChangedAt updates on round.opened and round.closed, not on state.sync or heartbeat', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useEventStream())

    const syncTime = new Date('2026-09-02T12:00:00.000Z')
    emit({
      type: 'state.sync',
      serverTime: syncTime,
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })
    expect(result.current.roundChangedAt).toBeNull()

    const heartbeatTime = new Date('2026-09-02T12:01:00.000Z')
    emit({ type: 'heartbeat', serverTime: heartbeatTime })
    expect(result.current.roundChangedAt).toBeNull()

    const openedTime = new Date('2026-09-02T12:02:00.000Z')
    emit({
      type: 'round.opened',
      serverTime: openedTime,
      roundId: 'r1',
      closesAt: new Date('2026-09-02T12:30:00.000Z'),
    })
    expect(result.current.roundChangedAt).toEqual(openedTime)

    const closedTime = new Date('2026-09-02T12:03:00.000Z')
    emit({ type: 'round.closed', serverTime: closedTime, roundId: 'r1' })
    expect(result.current.roundChangedAt).toEqual(closedTime)
  })

  it('rankingUpdatedAt updates only on ranking.updated', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useEventStream())

    emit({
      type: 'round.opened',
      serverTime: new Date('2026-09-02T12:00:00.000Z'),
      roundId: 'r1',
      closesAt: new Date('2026-09-02T12:30:00.000Z'),
    })
    expect(result.current.rankingUpdatedAt).toBeNull()

    const updatedTime = new Date('2026-09-02T12:05:00.000Z')
    emit({ type: 'ranking.updated', serverTime: updatedTime, round: null, event: { teams: [] } })
    expect(result.current.rankingUpdatedAt).toEqual(updatedTime)
  })

  it('tracks connection status changes reported by connectEventStream', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useEventStream())

    expect(result.current.status).toBe('connecting')

    const onStatusChange = connectEventStream.mock.calls.at(-1)?.[1] as (
      status: SseConnectionStatus,
    ) => void
    act(() => onStatusChange('open'))
    expect(result.current.status).toBe('open')

    act(() => onStatusChange('reconnecting'))
    expect(result.current.status).toBe('reconnecting')
  })
})
