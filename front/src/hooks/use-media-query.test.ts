import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setMatchMediaMatches } from '@/test/match-media-jsdom'
import { useMediaQuery } from './use-media-query'

const QUERY = '(min-width: 768px)'

afterEach(() => {
  cleanup()
  setMatchMediaMatches(QUERY, false)
})

describe('useMediaQuery', () => {
  it('reports the current match', () => {
    setMatchMediaMatches(QUERY, true)

    const { result } = renderHook(() => useMediaQuery(QUERY))

    expect(result.current).toBe(true)
  })

  it('updates when the query starts matching', () => {
    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)

    act(() => setMatchMediaMatches(QUERY, true))

    expect(result.current).toBe(true)
  })

  it('removes its listener on unmount', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: QUERY,
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList)

    const { unmount } = renderHook(() => useMediaQuery(QUERY))
    const [, listener] = addEventListener.mock.calls[0] as [string, () => void]

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('change', listener)
    spy.mockRestore()
  })
})
