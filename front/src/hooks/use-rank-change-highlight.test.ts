import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRankChangeHighlight } from './use-rank-change-highlight'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRankChangeHighlight', () => {
  it('never highlights a team whose rank never changes', () => {
    const rows = [
      { teamId: 't1', rank: 1 },
      { teamId: 't2', rank: 2 },
    ]
    const { result, rerender } = renderHook(({ rows }) => useRankChangeHighlight(rows), {
      initialProps: { rows },
    })
    expect(result.current.size).toBe(0)

    rerender({ rows: [...rows] })
    expect(result.current.size).toBe(0)
  })

  it('highlights a team the instant its rank changes, clearing after 3s', () => {
    const { result, rerender } = renderHook(({ rows }) => useRankChangeHighlight(rows), {
      initialProps: {
        rows: [
          { teamId: 't1', rank: 1 },
          { teamId: 't2', rank: 2 },
        ],
      },
    })

    rerender({
      rows: [
        { teamId: 't2', rank: 1 },
        { teamId: 't1', rank: 2 },
      ],
    })

    expect(result.current.has('t1')).toBe(true)
    expect(result.current.has('t2')).toBe(true)

    act(() => vi.advanceTimersByTime(2_999))
    expect(result.current.has('t1')).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.size).toBe(0)
  })

  it('does not highlight a team on its first appearance', () => {
    const { result } = renderHook(({ rows }) => useRankChangeHighlight(rows), {
      initialProps: { rows: [{ teamId: 't1', rank: 1 }] },
    })

    expect(result.current.size).toBe(0)
  })
})
