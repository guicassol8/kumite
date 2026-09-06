import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

vi.mock('@/lib/api', () => ({
  api: {
    teams: { $get: vi.fn() },
    rounds: Object.assign(vi.fn(), {
      $get: vi.fn(),
      ':id': { ranking: { $get: vi.fn() } },
    }),
    ranking: { $get: vi.fn() },
    problems: { ':id': { $get: vi.fn() } },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedTeams = vi.mocked(api.teams.$get)
const mockedRounds = vi.mocked(api.rounds.$get)
const mockedRoundRanking = vi.mocked(api.rounds[':id'].ranking.$get)
const mockedEventRanking = vi.mocked(api.ranking.$get)
const mockedProblem = vi.mocked(api.problems[':id'].$get)

const participant: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function emit(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

function emitStatus(status: 'connecting' | 'open' | 'reconnecting') {
  const onStatusChange = connectEventStream.mock.calls.at(-1)?.[1] as (s: string) => void
  act(() => onStatusChange(status))
}

const teamsEnvelope = (overrides: Partial<{ myTeamId: string | null }> = {}) => ({
  maxTeamSize: 4,
  mixingLocked: false,
  myTeamId: null,
  teams: [
    { id: 't1', name: 'Time 1', members: [{ university: 'pucrs', email: null }] },
    { id: 't2', name: 'Time 2', members: [{ university: 'merida', email: null }] },
  ],
  ...overrides,
})

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
    {
      teamId: 't2',
      teamName: 'Time 2',
      rank: 2,
      totalScore: 50,
      totalAttempts: 2,
      tiebreakTimeMs: 9000,
      problems: [{ problemId: 'p1', score: 50, attempts: 2 }],
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
    {
      teamId: 't2',
      teamName: 'Time 2',
      rank: 2,
      totalScore: 50,
      totalAttempts: 2,
      tiebreakTimeMs: 9000,
      rounds: [
        { roundId: 'r1', roundName: 'Rodada 1', score: 50, attempts: 2, tiebreakTimeMs: 9000 },
      ],
    },
  ],
}

function renderLeaderboard() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/leaderboard'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(vi.fn())
  mockedTeams.mockReset()
  mockedRounds.mockReset()
  mockedRoundRanking.mockReset()
  mockedEventRanking.mockReset()
  mockedProblem.mockReset()

  mockedTeams.mockResolvedValue(jsonResponse(200, teamsEnvelope()))
  mockedRounds.mockResolvedValue(jsonResponse(200, []))
  mockedRoundRanking.mockResolvedValue(jsonResponse(200, roundRanking))
  mockedEventRanking.mockResolvedValue(jsonResponse(200, eventRanking))
  mockedProblem.mockResolvedValue(jsonResponse(200, { title: 'Soma' }))

  setSession(participant, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('LeaderboardScreen — active round', () => {
  it('shows the round grid live, highlighting my team', async () => {
    mockedTeams.mockResolvedValue(jsonResponse(200, teamsEnvelope({ myTeamId: 't1' })))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    const row1 = screen.getByTestId('leaderboard-row-t1')
    expect(row1.textContent).toContain('Time 1')
    expect(row1.textContent).toContain('100')
    expect(screen.getByTestId('leaderboard-your-team-badge')).toBeDefined()
  })

  it('switches to the Geral tab and shows round columns', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))

    await waitFor(() => expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined())
    expect(screen.getByTestId('leaderboard-column-round-r1').textContent).toBe('Rodada 1')
  })
})

describe('LeaderboardScreen — round opens with zero submissions', () => {
  it('shows the round grid from REST as soon as round.opened arrives, before any ranking.updated', async () => {
    const emptyRoundRanking: RoundRanking = { ...roundRanking, teams: [] }
    mockedRoundRanking.mockResolvedValue(jsonResponse(200, emptyRoundRanking))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    // Simulates the connection's initial snapshot (state.sync + ranking.updated),
    // taken before the round opened — no active round yet.
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    await waitFor(() => expect(screen.getByTestId('leaderboard-empty-no-round')).toBeDefined())

    // The organizer opens a round while this client stays connected. No
    // submission has happened yet, so no fresh `ranking.updated` follows —
    // only `round.opened` — but the grid must still update (the reported bug).
    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })

    await waitFor(() => expect(mockedRoundRanking).toHaveBeenCalledWith({ param: { id: 'r1' } }))
    await waitFor(() => expect(screen.getByTestId('leaderboard-empty')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-empty-no-round')).toBeNull()
  })
})

describe('LeaderboardScreen — round closes live', () => {
  it('refetches rounds on round.closed so the last-closed label appears without a reload', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(200, []))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())

    // Organizer closes the round while this client stays connected — the
    // rounds list mock now reflects the closed round, simulating what the
    // API returns once refetched (the reported bug: nothing ever refetches
    // it, so `lastClosedRound` stays stuck on the pre-close snapshot).
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r1',
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T10:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T10:30:00.000Z'),
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })

    // A brand-new `lastClosedRanking` query key (only enabled once
    // `lastClosedRound` resolves) briefly flips `isLoading` back to true,
    // unmounting/remounting the (uncontrolled) Tabs — so click the round tab
    // on every poll until the screen settles, rather than once.
    await waitFor(() => {
      const roundTab = screen.getByTestId('leaderboard-tab-round')
      fireEvent.mouseDown(roundTab)
      expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined()
    })
    expect(screen.queryByTestId('leaderboard-empty-no-round')).toBeNull()
  })
})

describe('LeaderboardScreen — no active round', () => {
  it('shows the last closed round under "Rodada" and opens on "Geral" by default', async () => {
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r1',
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T10:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T10:30:00.000Z'),
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })

    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())
    expect(screen.getByTestId('leaderboard-table')).toBeDefined()
    expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined()

    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-round'))
    await waitFor(() => expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined())
    expect(screen.getByTestId('leaderboard-last-closed-label').textContent).toContain('Rodada 1')
    expect(screen.getByTestId('leaderboard-row-t1')).toBeDefined()
  })

  it('shows a dedicated empty state under "Rodada" when no round ever existed', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(200, []))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: null,
      event: { teams: [] },
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-empty-no-round')).toBeDefined())
  })
})

describe('LeaderboardScreen — connection banner', () => {
  it('shows a banner while connecting/reconnecting and hides it once open', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-connection-banner')).toBeDefined())

    emitStatus('open')
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.queryByTestId('leaderboard-connection-banner')).toBeNull())

    emitStatus('reconnecting')
    await waitFor(() => expect(screen.getByTestId('leaderboard-connection-banner')).toBeDefined())
  })
})

describe('LeaderboardScreen — empty state', () => {
  it('shows the empty state when the round has zero teams', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: { ...roundRanking, teams: [] },
      event: { teams: [] },
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-empty')).toBeDefined())
  })
})

describe('LeaderboardScreen — presentation mode', () => {
  beforeEach(() => {
    HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })
  })

  async function renderWithActiveRound() {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
  }

  it('enters presentation mode on toggle click and requests fullscreen', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)

    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('exits presentation mode when the browser reports fullscreen exit (Esc path)', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    act(() => document.dispatchEvent(new Event('fullscreenchange')))

    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('exits presentation mode via the toggle itself, calling exitFullscreen', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    fireEvent.click(toggle)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.querySelector('main'),
    })

    fireEvent.click(toggle)

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('degrades gracefully when requestFullscreen rejects', async () => {
    HTMLElement.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'))
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })
})
