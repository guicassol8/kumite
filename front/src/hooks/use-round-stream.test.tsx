import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import { clearSession, type SessionUser, setSession } from '@/lib/session'

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
})
