import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'

import { RoundCountdown } from './round-countdown'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('RoundCountdown', () => {
  it('shows the remaining time and ticks down every second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'))
    render(
      <RoundCountdown closesAt={new Date('2026-09-02T12:01:30.000Z')} serverTimeOffsetMs={0} />,
    )

    expect(screen.getByTestId('round-countdown').textContent).toContain('01:30')

    act(() => vi.advanceTimersByTime(1000))

    expect(screen.getByTestId('round-countdown').textContent).toContain('01:29')
  })

  it('corrects for client/server clock skew via serverTimeOffsetMs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'))
    // Server clock is 10s ahead of the client's.
    render(
      <RoundCountdown
        closesAt={new Date('2026-09-02T12:01:00.000Z')}
        serverTimeOffsetMs={10_000}
      />,
    )

    expect(screen.getByTestId('round-countdown').textContent).toContain('00:50')
  })

  it('clamps at zero instead of going negative or throwing once the deadline passes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:05.000Z'))
    render(
      <RoundCountdown closesAt={new Date('2026-09-02T12:00:00.000Z')} serverTimeOffsetMs={0} />,
    )

    expect(screen.getByTestId('round-countdown').textContent).toContain('00:00')

    expect(() => act(() => vi.advanceTimersByTime(5000))).not.toThrow()
    expect(screen.getByTestId('round-countdown').textContent).toContain('00:00')
  })
})
