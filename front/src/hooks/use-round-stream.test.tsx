import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import { clearSession, type SessionUser, setSession } from '@/lib/session'

import { useLeaderboardStream } from './use-leaderboard-stream'
import { RoundStreamProvider, useRoundStream } from './use-round-stream'

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

const unsubscribe = vi.fn()

beforeEach(() => {
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(unsubscribe)
  unsubscribe.mockClear()
})

afterEach(() => {
  // Unmount before clearing the session: a tree left mounted here reconnects
  // when the next case calls `setSession`, which would show up as a second
  // `connectEventStream` call in a test that counts them.
  cleanup()
  clearSession('manual')
})

describe('useRoundStream', () => {
  it('throws when used outside a RoundStreamProvider', () => {
    expect(() => renderHook(() => useRoundStream())).toThrow(
      'useRoundStream must be used within a RoundStreamProvider',
    )
  })

  it('opens a single SSE connection shared by every consumer under the provider', () => {
    setSession(fakeUser, 'tok-1')

    function useTwoConsumers() {
      const a = useRoundStream()
      const b = useRoundStream()
      return { a, b }
    }

    const { result } = renderHook(() => useTwoConsumers(), {
      wrapper: ({ children }) => <RoundStreamProvider>{children}</RoundStreamProvider>,
    })

    expect(connectEventStream).toHaveBeenCalledTimes(1)
    expect(result.current.a).toBe(result.current.b)
  })

  // The regression #274 fixes: `/leaderboard` mounted both hooks and each one
  // opened its own `/sse`, so a participant on that screen held two
  // connections. Both now select from the same provider.
  it('shares one connection between the round and leaderboard consumers', () => {
    setSession(fakeUser, 'tok-1')

    const { result } = renderHook(
      () => ({ round: useRoundStream(), leaderboard: useLeaderboardStream() }),
      { wrapper: ({ children }) => <RoundStreamProvider>{children}</RoundStreamProvider> },
    )

    expect(connectEventStream).toHaveBeenCalledTimes(1)
    // Two independent slices, deliberately not the same object: merging the
    // round reducer into the leaderboard's would blank the Header's current
    // round while a close is held back for judging (#176).
    expect(result.current.round).not.toBe(result.current.leaderboard)
  })

  it('throws a leaderboard-specific error when used outside a RoundStreamProvider', () => {
    expect(() => renderHook(() => useLeaderboardStream())).toThrow(
      'useLeaderboardStream must be used within a RoundStreamProvider',
    )
  })
})
