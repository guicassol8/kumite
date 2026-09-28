import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: { organizer: { stats: { live: { $get: vi.fn() } } } },
}))

import i18n from '@/i18n'

import { api } from '@/lib/api'

import { LiveStatsCard } from './live-stats-card'

const mockedLiveGet = vi.mocked(api.organizer.stats.live.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function liveStats(overrides: Record<string, unknown> = {}) {
  return {
    judge: { inFlight: 3, waiting: 2, concurrency: 4 },
    sse: { connections: 12 },
    submissions: {
      inFlight: 5,
      lastMinute: 7,
      perMinute: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 7],
    },
    ...overrides,
  }
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <LiveStatsCard />
    </QueryClientProvider>,
  )
}

/** Lets the timers and the promise chain they start settle inside act(). */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  mockedLiveGet.mockReset()
  focusManager.setFocused(true)
})

afterEach(() => {
  cleanup()
  focusManager.setFocused(undefined)
  vi.useRealTimers()
})

describe('LiveStatsCard', () => {
  it('shows the judge queue, the SSE connections and the submissions', async () => {
    mockedLiveGet.mockResolvedValue(jsonResponse(200, liveStats()))
    renderCard()
    await advance(0)

    expect(screen.getByTestId('overview-live-judge-in-flight').textContent).toBe('3')
    expect(screen.getByTestId('overview-live-judge-waiting').textContent).toContain('2')
    expect(screen.getByTestId('overview-live-judge-concurrency').textContent).toContain('4')
    expect(screen.getByTestId('overview-live-sse-connections').textContent).toBe('12')
    expect(screen.getByTestId('overview-live-submissions-last-minute').textContent).toBe('7')
    expect(screen.getByTestId('overview-live-submissions-in-flight').textContent).toContain('5')
    const sparkline = screen.getByTestId('overview-live-sparkline')
    expect(sparkline.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(15)
  })

  // CLDR files 0 under pt's "one" category, so without a `_zero` key the idle
  // card (the normal state between submissions) read "0 time sendo julgado".
  it('reads zero teams in flight in the plural in pt', async () => {
    await i18n.changeLanguage('pt')
    mockedLiveGet.mockResolvedValue(
      jsonResponse(
        200,
        liveStats({ submissions: { inFlight: 0, lastMinute: 0, perMinute: Array(15).fill(0) } }),
      ),
    )
    renderCard()
    await advance(0)

    expect(screen.getByTestId('overview-live-submissions-in-flight').textContent).toBe(
      '0 times sendo julgados',
    )
  })

  it('shows a loading state until the first answer', () => {
    mockedLiveGet.mockReturnValue(new Promise(() => {}))
    renderCard()

    expect(screen.getByTestId('overview-live-loading')).toBeDefined()
  })

  it('polls every 5 seconds', async () => {
    mockedLiveGet.mockResolvedValue(jsonResponse(200, liveStats()))
    renderCard()
    await advance(0)
    expect(mockedLiveGet).toHaveBeenCalledTimes(1)

    mockedLiveGet.mockResolvedValue(jsonResponse(200, liveStats({ sse: { connections: 13 } })))
    await advance(5_000)
    expect(mockedLiveGet).toHaveBeenCalledTimes(2)

    // The refetch's json() and TanStack's batched notify (a 0 ms timer) land
    // a few turns later.
    await advance(50)
    expect(screen.getByTestId('overview-live-sse-connections').textContent).toBe('13')
  })

  it('stops polling while the tab is hidden and resumes when it comes back', async () => {
    mockedLiveGet.mockResolvedValue(jsonResponse(200, liveStats()))
    renderCard()
    await advance(0)
    expect(mockedLiveGet).toHaveBeenCalledTimes(1)

    act(() => focusManager.setFocused(false))
    await advance(15_000)
    expect(mockedLiveGet).toHaveBeenCalledTimes(1)

    act(() => focusManager.setFocused(true))
    await advance(5_000)
    expect(mockedLiveGet.mock.calls.length).toBeGreaterThan(1)
  })

  it('shows an error state when the request fails', async () => {
    mockedLiveGet.mockResolvedValue(jsonResponse(500, { error: 'boom' }))
    renderCard()
    await advance(0)

    expect(screen.getByTestId('overview-live-error')).toBeDefined()
  })
})
