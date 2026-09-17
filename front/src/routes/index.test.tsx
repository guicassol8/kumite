import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    health: { $get: vi.fn() },
    teams: Object.assign(vi.fn(), { $get: vi.fn() }),
    rounds: Object.assign(vi.fn(), { $get: vi.fn(), ':id': { ranking: { $get: vi.fn() } } }),
    me: { $get: vi.fn() },
  },
}))

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedHealth = vi.mocked(api.health.$get)
const mockedTeams = vi.mocked(api.teams.$get)
const mockedRounds = vi.mocked(api.rounds.$get)
const mockedRoundRanking = vi.mocked(api.rounds[':id'].ranking.$get)
const sseUnsubscribe = vi.fn()

function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

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

const fakeOrganizer: SessionUser = {
  ...fakeUser,
  id: 'u2',
  email: 'organizer@edu.pucrs.br',
  role: 'organizer',
}

function roundSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'draft',
    durationMinutes: 30,
    openedAt: null,
    closesAt: null,
    closedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    problemCount: 2,
    ...overrides,
  }
}

function renderHome(initialEntry = '/') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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
  mockedHealth.mockReset()
  mockedTeams.mockReset()
  mockedRounds.mockReset()
  mockedRoundRanking.mockReset()
  connectEventStream.mockReset()
  sseUnsubscribe.mockReset()
  connectEventStream.mockReturnValue(sseUnsubscribe)
  mockedHealth.mockResolvedValue(jsonResponse(200, { status: 'ok' }))
  mockedRounds.mockResolvedValue(jsonResponse(200, []))
  clearSession('manual')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('Home', () => {
  it('does not show the notice banner by default', async () => {
    renderHome()

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'kumite', level: 1 })).toBeDefined(),
    )
    expect(screen.queryByTestId('home-notice-banner')).toBeNull()
  })

  it('keeps API status only in the footer', async () => {
    renderHome()
    await waitFor(() => expect(screen.getByRole('main')).toBeDefined())
    expect(within(screen.getByRole('main')).queryByTestId('api-status')).toBeNull()
    expect(within(screen.getByRole('main')).queryByTestId('api-status-ok')).toBeNull()
    await waitFor(() => expect(screen.getByTestId('api-status-ok')).toBeDefined())
  })

  it('shows the forbidden-organizer notice and dismisses it, clearing the search param', async () => {
    const router = renderHome('/?notice=forbidden-organizer')

    await waitFor(() => expect(screen.getByTestId('home-notice-banner')).toBeDefined())

    fireEvent.click(screen.getByTestId('home-notice-dismiss'))

    await waitFor(() => expect(screen.queryByTestId('home-notice-banner')).toBeNull())
    expect(router.state.location.search).toEqual({})
  })
})

describe('Home — team card', () => {
  it('stays hidden while anonymous, and asks for no team data', async () => {
    renderHome()

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'kumite', level: 1 })).toBeDefined(),
    )
    expect(screen.queryByTestId('home-team-card')).toBeNull()
    expect(mockedTeams).not.toHaveBeenCalled()
  })

  it('names the team and counts its members', async () => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, {
        maxTeamSize: 3,
        mixingLocked: false,
        myTeamId: 't1',
        teams: [
          {
            id: 't1',
            name: 'Blockly Busters',
            members: [
              { university: 'pucrs', email: 'ada@edu.pucrs.br' },
              { university: 'merida', email: 'grace@merida.edu.mx' },
            ],
            slotsAvailable: 1,
            frozen: false,
            joinBlockedReason: 'already_in_team',
          },
        ],
      }),
    )
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-team-card').textContent).toContain('Blockly Busters'),
    )
    expect(screen.getByTestId('home-team-card').textContent).toContain('2 de 3 integrantes')
  })

  it('says the user has no team yet and links to the listing', async () => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, { maxTeamSize: 3, mixingLocked: false, myTeamId: null, teams: [] }),
    )
    const router = renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-team-card').textContent).toContain(
        'Você ainda não está em um time.',
      ),
    )

    fireEvent.click(screen.getByTestId('home-team-cta'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/teams'))
  })
})

describe('Home — round card (#40)', () => {
  it('shows the waiting copy when no round is open', async () => {
    setSession(fakeUser, 'tok-1')
    mockedRounds.mockResolvedValue(jsonResponse(200, [roundSummary({ status: 'draft' })]))
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-round-card').textContent).toContain(
        'Aguardando a próxima rodada.',
      ),
    )
  })

  it('shows the open round name and a countdown once the stream reports it', async () => {
    setSession(fakeUser, 'tok-1')
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'r1',
          name: 'Rodada Abertura',
          status: 'open',
          openedAt: '2026-09-02T12:00:00.000Z',
          closesAt: '2026-09-02T12:30:00.000Z',
        }),
      ]),
    )
    renderHome()
    await waitFor(() => expect(connectEventStream).toHaveBeenCalledTimes(1))

    emitSse({
      type: 'state.sync',
      serverTime: new Date('2026-09-02T12:00:00.000Z'),
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })

    await waitFor(() =>
      expect(screen.getByTestId('home-round-card').textContent).toContain('Rodada Abertura'),
    )
    // Scoped to the home card: the header (#217) renders its own
    // `round-countdown` chip whenever a round is open, so the bare testid
    // matches two elements once both are mounted.
    expect(
      within(screen.getByTestId('home-round-card')).getByTestId('round-countdown'),
    ).toBeDefined()
    expect(screen.getByTestId('home-round-cta').getAttribute('href')).toBe('/rounds/r1')
  })

  it('reflects a round opening live, via SSE-triggered query invalidation, without a page reload', async () => {
    setSession(fakeUser, 'tok-1')
    mockedRounds.mockResolvedValueOnce(jsonResponse(200, []))
    renderHome()
    await waitFor(() =>
      expect(screen.getByTestId('home-round-card').textContent).toContain(
        'Aguardando a próxima rodada.',
      ),
    )
    await waitFor(() => expect(connectEventStream).toHaveBeenCalledTimes(1))

    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'r2',
          name: 'Rodada Ao Vivo',
          status: 'open',
          openedAt: '2026-09-02T12:00:00.000Z',
          closesAt: '2026-09-02T12:20:00.000Z',
        }),
      ]),
    )
    emitSse({
      type: 'round.opened',
      serverTime: new Date('2026-09-02T12:00:00.000Z'),
      roundId: 'r2',
      closesAt: new Date('2026-09-02T12:20:00.000Z'),
    })

    await waitFor(() =>
      expect(screen.getByTestId('home-round-card').textContent).toContain('Rodada Ao Vivo'),
    )
    expect(mockedRounds).toHaveBeenCalledTimes(2)
  })
})

describe('Home — closed rounds card (#40)', () => {
  it('shows nothing but the empty copy when there are no closed rounds', async () => {
    setSession(fakeUser, 'tok-1')
    mockedRounds.mockResolvedValue(jsonResponse(200, []))
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-closed-rounds').textContent).toContain(
        'Nenhuma rodada encerrada ainda.',
      ),
    )
  })

  it("lists closed rounds with the signed-in team's rank and score", async () => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, { maxTeamSize: 3, mixingLocked: false, myTeamId: 't1', teams: [] }),
    )
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'r9',
          name: 'Rodada Encerrada',
          status: 'closed',
          closedAt: '2026-09-01T18:30:00.000Z',
        }),
      ]),
    )
    mockedRoundRanking.mockResolvedValue(
      jsonResponse(200, {
        roundId: 'r9',
        roundName: 'Rodada Encerrada',
        problemIds: [],
        teams: [
          {
            teamId: 't1',
            teamName: 'Blockly Busters',
            rank: 3,
            totalScore: 120,
            totalAttempts: 5,
            tiebreakTimeMs: 1000,
            problems: [],
          },
        ],
      }),
    )
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-closed-rounds').textContent).toContain('Rodada Encerrada'),
    )
    await waitFor(() =>
      expect(screen.getByTestId('home-closed-round-result-r9').textContent).toContain(
        '#3 · 120 pts',
      ),
    )
    expect(screen.getByTestId('home-closed-round-r9').getAttribute('href')).toBe('/rounds/r9')
  })

  it('shows nothing extra when the user has no team', async () => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, { maxTeamSize: 3, mixingLocked: false, myTeamId: null, teams: [] }),
    )
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'r9',
          name: 'Rodada Encerrada',
          status: 'closed',
          closedAt: '2026-09-01T18:30:00.000Z',
        }),
      ]),
    )
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-closed-rounds').textContent).toContain('Rodada Encerrada'),
    )
    expect(screen.queryByTestId('home-closed-round-result-r9')).toBeNull()
    expect(mockedRoundRanking).not.toHaveBeenCalled()
  })

  it('shows nothing extra when the team never submitted in that round', async () => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, { maxTeamSize: 3, mixingLocked: false, myTeamId: 't1', teams: [] }),
    )
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'r9',
          name: 'Rodada Encerrada',
          status: 'closed',
          closedAt: '2026-09-01T18:30:00.000Z',
        }),
      ]),
    )
    // getRoundRanking (#184) omits a team from a round it never submitted
    // in — this is what that looks like: an empty ranking.
    mockedRoundRanking.mockResolvedValue(
      jsonResponse(200, {
        roundId: 'r9',
        roundName: 'Rodada Encerrada',
        problemIds: [],
        teams: [],
      }),
    )
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-closed-rounds').textContent).toContain('Rodada Encerrada'),
    )
    await waitFor(() => expect(mockedRoundRanking).toHaveBeenCalled())
    expect(screen.queryByTestId('home-closed-round-result-r9')).toBeNull()
  })

  it("shows nothing extra while the round's ranking is still loading", async () => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, { maxTeamSize: 3, mixingLocked: false, myTeamId: 't1', teams: [] }),
    )
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'r9',
          name: 'Rodada Encerrada',
          status: 'closed',
          closedAt: '2026-09-01T18:30:00.000Z',
        }),
      ]),
    )
    mockedRoundRanking.mockReturnValue(new Promise(() => {}))
    renderHome()

    await waitFor(() =>
      expect(screen.getByTestId('home-closed-rounds').textContent).toContain('Rodada Encerrada'),
    )
    expect(screen.queryByTestId('home-closed-round-result-r9')).toBeNull()
  })
})

describe('Home — organizer shortcuts card (#40)', () => {
  it('stays hidden for a participant', async () => {
    setSession(fakeUser, 'tok-1')
    renderHome()

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'kumite', level: 1 })).toBeDefined(),
    )
    expect(screen.queryByTestId('home-organizer-shortcuts')).toBeNull()
  })

  it('shows a shortcut to the problems screen for an organizer', async () => {
    setSession(fakeOrganizer, 'tok-2')
    renderHome()

    await waitFor(() => expect(screen.getByTestId('home-organizer-shortcuts')).toBeDefined())
    expect(screen.getByTestId('home-organizer-shortcuts-problems').getAttribute('href')).toBe(
      '/organizer/problems',
    )
    expect(screen.getByTestId('home-organizer-shortcuts-rounds').getAttribute('href')).toBe(
      '/organizer/rounds',
    )
  })
})

describe('Home — latest closed round', () => {
  beforeEach(() => {
    setSession(fakeUser, 'tok-1')
    mockedTeams.mockResolvedValue(
      jsonResponse(200, {
        maxTeamSize: 4,
        mixingLocked: false,
        myTeamId: 't1',
        teams: [
          {
            id: 't1',
            name: 'Byte Fighters',
            members: [],
            slotsAvailable: 4,
            frozen: false,
            joinBlockedReason: 'already_in_team',
          },
        ],
      }),
    )
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({
          id: 'old',
          name: 'Anterior',
          status: 'closed',
          closedAt: '2026-09-01T18:00:00Z',
        }),
        roundSummary({
          id: 'latest',
          name: 'Mais recente',
          status: 'closed',
          closedAt: '2026-09-02T18:00:00Z',
        }),
      ]),
    )
  })

  function ranking(rank: number) {
    return { teams: [{ teamId: 't1', rank, totalScore: 100 }], problemIds: [] }
  }

  it('uses the most recently closed round regardless of API order and shares ranking requests', async () => {
    mockedRoundRanking.mockImplementation(async ({ param }) =>
      jsonResponse(200, ranking(param.id === 'latest' ? 2 : 7)),
    )
    renderHome()
    await waitFor(() =>
      expect(screen.getByTestId('home-team-last-result').textContent).toContain(
        '#2 na Mais recente',
      ),
    )
    const links = within(screen.getByTestId('home-closed-rounds')).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Mais recente', 'Anterior'])
    expect(mockedRoundRanking).toHaveBeenCalledTimes(2)
  })

  it('does not fall back to an older result when absent from the latest ranking', async () => {
    mockedRoundRanking.mockImplementation(async ({ param }) =>
      jsonResponse(200, param.id === 'latest' ? { teams: [], problemIds: [] } : ranking(7)),
    )
    renderHome()
    await waitFor(() => expect(screen.getByTestId('home-closed-round-result-old')).toBeDefined())
    expect(screen.queryByTestId('home-team-last-result')).toBeNull()
  })

  it.each(['pending', 'error'])(
    'does not invent a result while the latest ranking is %s',
    async (state) => {
      mockedRoundRanking.mockImplementation(({ param }) => {
        if (param.id === 'old') return Promise.resolve(jsonResponse(200, ranking(7)))
        return state === 'pending' ? new Promise(() => {}) : Promise.resolve(jsonResponse(500, {}))
      })
      renderHome()
      await waitFor(() => expect(screen.getByTestId('home-closed-round-result-old')).toBeDefined())
      expect(screen.queryByTestId('home-team-last-result')).toBeNull()
    },
  )
})
