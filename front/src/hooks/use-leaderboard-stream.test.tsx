import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'

import { OFFLINE_AFTER_MS, useLeaderboardStream } from './use-leaderboard-stream'
import { RoundStreamProvider, useRoundStream } from './use-round-stream'

// #274: the hook is a selector over the app's single `/sse` connection now,
// so every case mounts it under the provider that owns that connection —
// which is also how it is mounted for real, from `__root`.
const wrapper = ({ children }: { children: ReactNode }) => (
  <RoundStreamProvider>{children}</RoundStreamProvider>
)

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const roundRanking: RoundRanking = {
  roundId: 'r1',
  roundName: 'Rodada 1',
  problemIds: ['p1'],
  denominators: 'consistent',
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
    renderHook(() => useLeaderboardStream(), { wrapper })
    expect(connectEventStream).not.toHaveBeenCalled()
  })

  it('applies ranking.updated with a populated round', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    const serverTime = new Date('2026-09-05T12:00:00.000Z')
    emit({ type: 'ranking.updated', serverTime, round: roundRanking, event: eventRanking })

    expect(result.current.round).toEqual(roundRanking)
    expect(result.current.event).toEqual(eventRanking)
    expect(result.current.serverTime).toEqual(serverTime)
  })

  it('applies ranking.updated with a null round (no active round)', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

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
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

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
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    expect(result.current.connectionStatus).toBe('connecting')
    emitStatus('open')
    expect(result.current.connectionStatus).toBe('open')
    emitStatus('reconnecting')
    expect(result.current.connectionStatus).toBe('reconnecting')
  })

  it('disconnects on logout / unmount', () => {
    setSession(fakeUser, 'tok-1')
    const { unmount } = renderHook(() => useLeaderboardStream(), { wrapper })

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('sets activeRoundId from state.sync', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    emit({
      type: 'state.sync',
      submissionsPaused: false,
      serverTime: new Date(),
      round: { id: 'r1', closesAt: new Date('2026-09-05T13:00:00.000Z') },
    })
    expect(result.current.activeRoundId).toBe('r1')

    emit({ type: 'state.sync', serverTime: new Date(), round: null, submissionsPaused: false })
    expect(result.current.activeRoundId).toBeNull()
  })

  it('sets activeRoundId on round.opened, before any ranking.updated arrives', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

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
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })

    expect(result.current.activeRoundId).toBeNull()
  })

  // Was an `onRoundChange` callback on this hook; since #274 the round-change
  // signal is `roundChangedAt` on the shared provider, which the route reads
  // instead. Same two events, same two notifications — one connection.
  it('advances roundChangedAt on round.opened and round.closed, on the same connection', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(
      () => ({ leaderboard: useLeaderboardStream(), round: useRoundStream() }),
      { wrapper },
    )

    const openedAt = new Date('2026-09-05T12:00:00.000Z')
    emit({
      type: 'round.opened',
      serverTime: openedAt,
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    expect(result.current.round.roundChangedAt).toEqual(openedAt)
    expect(result.current.leaderboard.activeRoundId).toBe('r1')

    const closedAt = new Date('2026-09-05T12:30:00.000Z')
    emit({ type: 'round.closed', serverTime: closedAt, roundId: 'r1' })
    expect(result.current.round.roundChangedAt).toEqual(closedAt)
    expect(result.current.leaderboard.activeRoundId).toBeNull()

    expect(connectEventStream).toHaveBeenCalledTimes(1)
  })

  it('keeps activeRoundId in sync with ranking.updated', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

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
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    emit({
      type: 'state.sync',
      submissionsPaused: false,
      serverTime: new Date(),
      round: { id: 'r1', closesAt: new Date('2026-09-05T13:00:00.000Z') },
    })
    expect(result.current.closesAt).toEqual(new Date('2026-09-05T13:00:00.000Z'))

    emit({ type: 'state.sync', serverTime: new Date(), round: null, submissionsPaused: false })
    expect(result.current.closesAt).toBeNull()
  })

  it('sets closesAt on round.opened and clears it on round.closed', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

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
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

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

describe('useLeaderboardStream — offline detection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags the stream as offline after OFFLINE_AFTER_MS without an open connection', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    expect(result.current.isLive).toBe(false)
    expect(result.current.isOffline).toBe(false)

    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1))
    expect(result.current.isOffline).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.isOffline).toBe(true)
  })

  // The sse-client publishes a fresh 'reconnecting' on every retry (every
  // SSE_RETRY_DELAY_MS). If the timer were keyed on `connectionStatus`
  // instead of on `isLive`, each retry would rearm the timeout and a stream
  // that never comes back would never be reported as offline.
  it('still goes offline while the client keeps re-announcing "reconnecting"', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    for (let elapsed = 0; elapsed < OFFLINE_AFTER_MS; elapsed += 2000) {
      emitStatus('reconnecting')
      act(() => vi.advanceTimersByTime(2000))
    }

    expect(result.current.isOffline).toBe(true)
  })

  it('does not flag a blip that reconnects before the threshold', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    emitStatus('open')
    emitStatus('reconnecting')
    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1000))
    emitStatus('open')
    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS))

    expect(result.current.isLive).toBe(true)
    expect(result.current.isOffline).toBe(false)
  })

  it('clears the offline flag once the connection opens again', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    act(() => vi.advanceTimersByTime(OFFLINE_AFTER_MS))
    expect(result.current.isOffline).toBe(true)

    emitStatus('open')
    expect(result.current.isOffline).toBe(false)
    expect(result.current.isLive).toBe(true)
  })
})

describe('useLeaderboardStream — reconnect()', () => {
  it('drops the current connection and opens a new one', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })
    expect(connectEventStream).toHaveBeenCalledTimes(1)

    act(() => result.current.reconnect())

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(connectEventStream).toHaveBeenCalledTimes(2)
  })

  // Acceptance #5: a manual retry must never blank out the board that is
  // already on screen — only a logout resets the state.
  it('keeps the last ranking while reconnecting', () => {
    setSession(fakeUser, 'tok-1')
    const { result } = renderHook(() => useLeaderboardStream(), { wrapper })

    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    act(() => result.current.reconnect())

    expect(result.current.round).toEqual(roundRanking)
    expect(result.current.event).toEqual(eventRanking)
  })

  it('keeps a stable identity across renders', () => {
    setSession(fakeUser, 'tok-1')
    const { result, rerender } = renderHook(() => useLeaderboardStream(), { wrapper })

    const first = result.current.reconnect
    rerender()

    expect(result.current.reconnect).toBe(first)
  })
})
