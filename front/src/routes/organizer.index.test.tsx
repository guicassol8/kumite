import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: { stats: { $get: vi.fn() } },
    rounds: { ':id': { ranking: { $get: vi.fn() } } },
  },
}))

// The overview subscribes to /sse. The stream's own parsing is covered by
// use-event-stream.test.ts; captured here so a test can push an event
// through the screen's callbacks without opening a real EventSource.
const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedStatsGet = vi.mocked(api.organizer.stats.$get)
const mockedRankingGet = vi.mocked(api.rounds[':id'].ranking.$get)
const sseUnsubscribe = vi.fn()

function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

const organizerUser: SessionUser = {
  id: 'u1',
  email: 'org@edu.pucrs.br',
  role: 'organizer',
  university: 'pucrs',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function roundRef(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'open',
    openedAt: '2026-09-02T12:00:00.000Z',
    closesAt: '2026-09-02T12:30:00.000Z',
    closedAt: null,
    ...overrides,
  }
}

function stats(overrides: Record<string, unknown> = {}) {
  return {
    participants: { total: 40, pucrs: 25, merida: 15, inTeam: 30, withoutTeam: 10 },
    teams: { total: 8, openSlots: 6, maxTeamSize: 4 },
    submissions: { total: 120, inRound: 17 },
    round: { active: null, lastClosed: null },
    ...overrides,
  }
}

function rankingTeam(overrides: Record<string, unknown> = {}) {
  return {
    teamId: 't1',
    teamName: 'Blockly Busters',
    rank: 1,
    totalScore: 300,
    totalAttempts: 4,
    tiebreakTimeMs: 1000,
    problems: [],
    ...overrides,
  }
}

function renderScreen() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedStatsGet.mockReset()
  mockedRankingGet.mockReset()
  connectEventStream.mockReset()
  sseUnsubscribe.mockReset()
  connectEventStream.mockReturnValue(sseUnsubscribe)
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('organizer overview', () => {
  it('shows signups per university, teams and submissions', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-signups-total').textContent).toContain('40'),
    )
    expect(screen.getByTestId('overview-signups-pucrs').textContent).toContain('25')
    expect(screen.getByTestId('overview-signups-merida').textContent).toContain('15')
    expect(screen.getByTestId('overview-teams-total').textContent).toContain('8')
    expect(screen.getByTestId('overview-teams-members').textContent).toContain('30')
    expect(screen.getByTestId('overview-teams-slots').textContent).toContain('6')
    expect(screen.getByTestId('overview-teams-without-team').textContent).toContain('10')
    expect(screen.getByTestId('overview-submissions-total').textContent).toContain('120')
  })

  it('shows the timer and this round´s submissions while a round is open', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 17 },
          round: { active: roundRef(), lastClosed: null },
        }),
      ),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-round-name').textContent).toContain('Rodada 1'),
    )
    expect(screen.getByTestId('round-countdown')).toBeDefined()
    expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
      '17 nesta rodada',
    )
    // A live ranking mid-round would be a spoiler — and nothing was fetched.
    expect(screen.queryByTestId('overview-round-podium')).toBeNull()
    expect(mockedRankingGet).not.toHaveBeenCalled()
  })

  // The "ao vivo" half of the open-round criterion: a judged submission is
  // announced as ranking.updated (#44), and the screen answers it by
  // refetching its own numbers — no reload, no new SSE event type.
  it('refetches this round´s submissions live when ranking.updated arrives', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 17 },
          round: { active: roundRef(), lastClosed: null },
        }),
      ),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
        '17 nesta rodada',
      ),
    )
    await waitFor(() => expect(connectEventStream).toHaveBeenCalledTimes(1))

    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 121, inRound: 18 },
          round: { active: roundRef(), lastClosed: null },
        }),
      ),
    )
    emitSse({
      type: 'ranking.updated',
      serverTime: new Date('2026-09-02T12:05:00.000Z'),
      round: null,
      event: { teams: [] },
    })

    await waitFor(() =>
      expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
        '18 nesta rodada',
      ),
    )
    expect(screen.getByTestId('overview-submissions-total').textContent).toContain('121')
    expect(mockedStatsGet).toHaveBeenCalledTimes(2)
  })

  it('shows the last closed round with its podium when no round is open', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 9 },
          round: {
            active: null,
            lastClosed: roundRef({
              id: 'r-closed',
              name: 'Rodada 2',
              status: 'closed',
              closedAt: '2026-09-02T13:00:00.000Z',
            }),
          },
        }),
      ),
    )
    mockedRankingGet.mockResolvedValue(
      jsonResponse(200, {
        roundId: 'r-closed',
        roundName: 'Rodada 2',
        problemIds: [],
        teams: [
          rankingTeam(),
          rankingTeam({ teamId: 't2', teamName: 'Loop Masters', rank: 2, totalScore: 200 }),
          // getRoundRanking lists every team for every closed round (#43);
          // one that never submitted is not a podium finisher (#131).
          rankingTeam({ teamId: 't3', teamName: 'Fantasma', rank: 3, totalAttempts: 0 }),
        ],
      }),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-round-name').textContent).toContain('Rodada 2'),
    )
    expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
      '9 na última rodada',
    )
    await waitFor(() =>
      expect(screen.getByTestId('overview-round-podium-t1').textContent).toContain(
        'Blockly Busters',
      ),
    )
    expect(screen.getByTestId('overview-round-podium-t2').textContent).toContain('Loop Masters')
    expect(screen.queryByTestId('overview-round-podium-t3')).toBeNull()
    expect(mockedRankingGet).toHaveBeenCalledWith({ param: { id: 'r-closed' } })
  })

  it('offers the four panel shortcuts', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))

    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-shortcuts-card')).toBeDefined())
    expect(screen.getByTestId('overview-shortcuts-problems').getAttribute('href')).toBe(
      '/organizer/problems',
    )
    expect(screen.getByTestId('overview-shortcuts-rounds').getAttribute('href')).toBe(
      '/organizer/rounds',
    )
    expect(screen.getByTestId('overview-shortcuts-teams').getAttribute('href')).toBe(
      '/organizer/teams',
    )
    expect(screen.getByTestId('overview-shortcuts-event-config').getAttribute('href')).toBe(
      '/organizer/event-config',
    )
    expect(screen.getByTestId('overview-shortcuts-users').getAttribute('href')).toBe(
      '/organizer/users',
    )
  })

  it('offers a retry when the stats request fails', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-error')).toBeDefined())
    expect(screen.getByTestId('overview-retry')).toBeDefined()
  })
})
