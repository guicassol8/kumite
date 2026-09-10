import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'

import { useLeaderboardStream } from './use-leaderboard-stream'

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

const roundRanking: RoundRanking = {
  roundId: 'r1',
  roundName: 'Rodada 1',
  problemIds: ['p1'],
  teams: [
    {
      teamId: 't1',
      teamName: 'Time 1',
      rank: 1,
      totalScore: 100,
      totalAttempts: 1,
      tiebreakTimeMs: 5000,
      problems: [{ problemId: 'p1', score: 100, attempts: 1 }],
    },
  ],
}

const eventRanking: EventRanking = {
  teams: [
    {
      teamId: 't1',
      teamName: 'Time 1',
      rank: 1,
      totalScore: 100,
      totalAttempts: 1,
      tiebreakTimeMs: 5000,
      rounds: [
        { roundId: 'r1', roundName: 'Rodada 1', score: 100, attempts: 1, tiebreakTimeMs: 5000 },
      ],
    },
  ],
}

function emit(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

function emitStatus(status: 'connecting' | 'open' | 'reconnecting') {
  const onStatusChange = connectEventStream.mock.calls.at(-1)?.[1] as (s: string) => void
  act(() => onStatusChange(status))
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

describe('useLeaderboardStream', () => {
  it('does not connect while anonymous', () => {
    clearSession('manual')
    renderHook(() => useLeaderboardStream())
    expect(connectEventStream).not.toHaveBeenCalled()
  })

  it('applies ranking.updated with a populated round', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    const serverTime = new Date('2026-09-05T12:00:00.000Z')
    emit({ type: 'ranking.updated', serverTime, round: roundRanking, event: eventRanking })

    expect(result.current.round).toEqual(roundRanking)
    expect(result.current.event).toEqual(eventRanking)
    expect(result.current.serverTime).toEqual(serverTime)
  })

  it('applies ranking.updated with a null round (no active round)', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: null,
      event: eventRanking,
    })

    expect(result.current.round).toBeNull()
    expect(result.current.event).toEqual(eventRanking)
  })

  it('applies heartbeat, updating only serverTime', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    const heartbeatTime = new Date('2026-09-05T12:05:00.000Z')
    emit({ type: 'heartbeat', serverTime: heartbeatTime })

    expect(result.current.serverTime).toEqual(heartbeatTime)
    expect(result.current.round).toEqual(roundRanking)
  })

  it('reflects connectionStatus changes', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    expect(result.current.connectionStatus).toBe('connecting')
    emitStatus('open')
    expect(result.current.connectionStatus).toBe('open')
    emitStatus('reconnecting')
    expect(result.current.connectionStatus).toBe('reconnecting')
  })

  it('disconnects on logout / unmount', () => {
    setSession(fakeUser, 'tok-1')
    const { unmount } = renderHook(() => useLeaderboardStream())

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('sets activeRoundId from state.sync', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'state.sync',
      serverTime: new Date(),
      round: { id: 'r1', closesAt: new Date('2026-09-05T13:00:00.000Z') },
    })
    expect(result.current.activeRoundId).toBe('r1')

    emit({ type: 'state.sync', serverTime: new Date(), round: null })
    expect(result.current.activeRoundId).toBeNull()
  })

  it('sets activeRoundId on round.opened, before any ranking.updated arrives', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })

    expect(result.current.activeRoundId).toBe('r1')
    expect(result.current.round).toBeNull()
  })

  it('clears activeRoundId on round.closed', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })

    expect(result.current.activeRoundId).toBeNull()
  })

  it('calls onRoundChange on round.opened and round.closed', () => {
    setSession(fakeUser, 'tok-1')
    const onRoundChange = vi.fn()
    renderHook(() => useLeaderboardStream(onRoundChange))

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    expect(onRoundChange).toHaveBeenCalledTimes(1)

    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })
    expect(onRoundChange).toHaveBeenCalledTimes(2)
  })

  it('keeps activeRoundId in sync with ranking.updated', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    expect(result.current.activeRoundId).toBe('r1')

    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    expect(result.current.activeRoundId).toBeNull()
  })

  it('hydrates closesAt from state.sync', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'state.sync',
      serverTime: new Date(),
      round: { id: 'r1', closesAt: new Date('2026-09-05T13:00:00.000Z') },
    })
    expect(result.current.closesAt).toEqual(new Date('2026-09-05T13:00:00.000Z'))

    emit({ type: 'state.sync', serverTime: new Date(), round: null })
    expect(result.current.closesAt).toBeNull()
  })

  it('sets closesAt on round.opened and clears it on round.closed', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    expect(result.current.closesAt).toEqual(new Date('2026-09-05T13:00:00.000Z'))

    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })
    expect(result.current.closesAt).toBeNull()
  })

  it('updates closesAt on round.extended for the active round only', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream())

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })

    emit({
      type: 'round.extended',
      serverTime: new Date(),
      roundId: 'r2',
      closesAt: new Date('2026-09-05T14:00:00.000Z'),
    })
    expect(result.current.closesAt).toEqual(new Date('2026-09-05T13:00:00.000Z'))

    emit({
      type: 'round.extended',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T15:00:00.000Z'),
    })
    expect(result.current.closesAt).toEqual(new Date('2026-09-05T15:00:00.000Z'))
  })
})
