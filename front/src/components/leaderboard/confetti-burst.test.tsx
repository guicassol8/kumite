import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setMatchMediaMatches } from '@/test/match-media-jsdom'

import {
  CONFETTI_LIFETIME_MS,
  CONFETTI_PIECES,
  CONFETTI_STILL_LIFETIME_MS,
  ConfettiBurst,
} from './confetti-burst'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setMatchMediaMatches(REDUCED_MOTION, false)
})

function pieces() {
  return screen.queryAllByTestId('podium-confetti-piece')
}

describe('ConfettiBurst', () => {
  it('renders nothing until the first trigger', () => {
    render(<ConfettiBurst trigger={0} />)

    expect(screen.queryByTestId('podium-confetti')).toBeNull()
  })

  it('mounts one full-screen, hidden, click-through layer of pieces on a trigger', () => {
    render(<ConfettiBurst trigger={1} />)

    const layer = screen.getByTestId('podium-confetti')
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(layer.className).toContain('pointer-events-none')
    expect(layer.className).toContain('fixed')
    expect(pieces()).toHaveLength(CONFETTI_PIECES)
  })

  it('paints the pieces only with token fills', () => {
    render(<ConfettiBurst trigger={1} />)

    for (const piece of pieces()) {
      expect(piece.className).toMatch(/\bbg-(brand|foreground|warning)\b/)
    }
  })

  it('removes the layer once the burst is over', () => {
    render(<ConfettiBurst trigger={1} />)

    act(() => {
      vi.advanceTimersByTime(CONFETTI_LIFETIME_MS - 1)
    })
    expect(screen.getByTestId('podium-confetti')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByTestId('podium-confetti')).toBeNull()
  })

  it('restarts the burst on a second trigger, keeping a single layer', () => {
    const { rerender } = render(<ConfettiBurst trigger={1} />)
    act(() => {
      vi.advanceTimersByTime(CONFETTI_LIFETIME_MS - 100)
    })

    rerender(<ConfettiBurst trigger={2} />)

    expect(screen.getAllByTestId('podium-confetti')).toHaveLength(1)
    expect(pieces()).toHaveLength(CONFETTI_PIECES)
    // The first burst's clock no longer applies: the second one runs in full.
    act(() => {
      vi.advanceTimersByTime(CONFETTI_LIFETIME_MS - 1)
    })
    expect(screen.getByTestId('podium-confetti')).toBeDefined()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByTestId('podium-confetti')).toBeNull()
  })

  it('starts every piece above the screen when motion is allowed', () => {
    render(<ConfettiBurst trigger={1} />)

    const layer = screen.getByTestId('podium-confetti')
    expect(layer.dataset.reducedMotion).toBe('false')
    expect(pieces()).toHaveLength(CONFETTI_PIECES)
    for (const piece of pieces()) {
      expect(piece.style.transform).toContain('translateY(-10vh)')
    }
  })

  it('with reduced motion, renders the pieces already at rest and drops them after ~3 s', () => {
    setMatchMediaMatches(REDUCED_MOTION, true)
    render(<ConfettiBurst trigger={1} />)

    const layer = screen.getByTestId('podium-confetti')
    expect(layer.dataset.reducedMotion).toBe('true')
    // Born in the final state: nothing starts above the screen to fall from.
    expect(pieces()).toHaveLength(CONFETTI_PIECES)
    for (const piece of pieces()) {
      expect(piece.style.transform).not.toContain('-10vh')
      expect(piece.style.transform).toMatch(/translateY\(\d+(\.\d+)?vh\)/)
    }

    act(() => {
      vi.advanceTimersByTime(CONFETTI_STILL_LIFETIME_MS)
    })
    expect(screen.queryByTestId('podium-confetti')).toBeNull()
  })
})
