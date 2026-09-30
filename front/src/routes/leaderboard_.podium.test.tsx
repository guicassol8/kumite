import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  isRedirect,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Both mocks, as front/AGENTS.md requires of a test that mounts routeTree.gen:
// the SSE reader fetches outside the RPC client. The leaderboard endpoints are
// here too because leaving the pódio lands on /leaderboard.
vi.mock('@/lib/sse-client', () => ({ connectEventStream: vi.fn(() => () => {}) }))

vi.mock('@/lib/api', () => ({
  api: {
    ranking: { $get: vi.fn() },
    organizer: { teams: { $get: vi.fn() } },
    teams: { $get: vi.fn() },
    rounds: Object.assign(vi.fn(), {
      $get: vi.fn(),
      ':id': { ranking: { $get: vi.fn() } },
    }),
    problems: { ':id': { $get: vi.fn() } },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { setPresentationActive } from '@/lib/presentation-mode'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { EventRanking } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

import { Route } from './leaderboard_.podium'

const mockedRanking = vi.mocked(api.ranking.$get)
const mockedOrganizerTeams = vi.mocked(api.organizer.teams.$get)
const mockedTeams = vi.mocked(api.teams.$get)
const mockedRounds = vi.mocked(api.rounds.$get)

const participant: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const organizer: SessionUser = { ...participant, id: 'u2', role: 'organizer' }

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function team(index: number, totalScore: number) {
  return {
    teamId: `t${index}`,
    teamName: `Time ${index}`,
    rank: index,
    totalScore,
    totalAttempts: 1,
    tiebreakTimeMs: 1000 * index,
    rounds: [],
  }
}

const eventRanking: EventRanking = {
  rounds: [],
  teams: [team(1, 300), team(2, 200), team(3, 100), team(4, 0)],
}

const organizerTeams = {
  maxTeamSize: 3,
  teams: [1, 2, 3, 4].map((index) => ({
    id: `t${index}`,
    name: `Time ${index}`,
    frozen: false,
    slotsAvailable: 2,
    members: [
      {
        userId: `u-${index}`,
        email: `membro${index}@edu.pucrs.br`,
        name: `Membro ${index}`,
        university: index % 2 === 0 ? 'merida' : 'pucrs',
        role: 'participant',
      },
    ],
  })),
}

function renderPodium() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/leaderboard/podium'] }),
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
  mockedRanking.mockReset()
  mockedOrganizerTeams.mockReset()
  mockedTeams.mockReset()
  mockedRounds.mockReset()

  mockedRanking.mockResolvedValue(jsonResponse(200, eventRanking))
  mockedOrganizerTeams.mockResolvedValue(jsonResponse(200, organizerTeams))
  mockedTeams.mockResolvedValue(
    jsonResponse(200, { maxTeamSize: 3, mixingLocked: false, myTeamId: null, teams: [] }),
  )
  mockedRounds.mockResolvedValue(jsonResponse(200, []))

  document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
  setSession(organizer, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
  setPresentationActive(false)
  document.documentElement.className = ''
})

describe('/leaderboard/podium — access', () => {
  it('sends a participant home with the forbidden-organizer notice, like every organizer route', async () => {
    setSession(participant, 'tok-1')
    const beforeLoad = Route.options.beforeLoad as unknown as (context: {
      location: { href: string }
    }) => Promise<void>

    let caught: unknown
    try {
      await beforeLoad({ location: { href: '/leaderboard/podium' } })
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect(caught).toMatchObject({
      options: { to: '/', search: { notice: 'forbidden-organizer' } },
    })
  })

  it('lets the organizer in', async () => {
    const beforeLoad = Route.options.beforeLoad as unknown as (context: {
      location: { href: string }
    }) => Promise<void>

    await expect(beforeLoad({ location: { href: '/leaderboard/podium' } })).resolves.toBeUndefined()
  })
})

describe('/leaderboard/podium — the ceremony', () => {
  it('shows the three places with their members, from GET /ranking and GET /organizer/teams', async () => {
    renderPodium()

    const first = await screen.findByTestId('podium-place-1')
    expect(within(first).getByTestId('podium-team-name-1').textContent).toBe('Time 1')
    expect(within(first).getByTestId('podium-members-1').textContent).toBe('Membro 1')
    expect(within(first).getByTestId('university-badge-pucrs')).toBeDefined()
    expect(
      within(screen.getByTestId('podium-place-2')).getByTestId('university-badge-merida'),
    ).toBeDefined()
    expect(screen.getByTestId('podium-place-3')).toBeDefined()
    expect(mockedRanking).toHaveBeenCalledTimes(1)
    expect(mockedOrganizerTeams).toHaveBeenCalledTimes(1)
  })

  it('never projects a member e-mail, though the organizer listing carries one', async () => {
    renderPodium()

    await screen.findByTestId('podium-place-1')
    expect(screen.getByTestId('podium-board').textContent).not.toContain('@')
  })

  it('leaves the zero-point team out of the podium and the list', async () => {
    renderPodium()

    await screen.findByTestId('podium-place-3')
    expect(screen.queryByTestId('podium-rest')).toBeNull()
    expect(screen.getByTestId('podium-board').textContent).not.toContain('Time 4')
  })

  it('hides the header and footer while it is up', async () => {
    renderPodium()

    await screen.findByTestId('podium-board')
    expect(screen.queryByTestId('header-user-email')).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('still shows the podium, without members, when only the team listing fails', async () => {
    mockedOrganizerTeams.mockResolvedValue(jsonResponse(500, {}))
    renderPodium()

    const first = await screen.findByTestId('podium-place-1')
    expect(within(first).getByTestId('podium-team-name-1').textContent).toBe('Time 1')
    expect(screen.queryByTestId('podium-members-1')).toBeNull()
    expect(screen.queryByTestId('podium-error')).toBeNull()
  })

  it('shows the error when the ranking fails, and retrying fetches it again', async () => {
    mockedRanking.mockResolvedValue(jsonResponse(500, {}))
    renderPodium()

    await screen.findByTestId('podium-error')
    mockedRanking.mockResolvedValue(jsonResponse(200, eventRanking))
    fireEvent.click(screen.getByTestId('podium-error-retry'))

    await screen.findByTestId('podium-place-1')
    expect(mockedRanking).toHaveBeenCalledTimes(2)
  })
})

describe('/leaderboard/podium — leaving', () => {
  it('goes back to /leaderboard once, even when leaving fullscreen fires its own exit', async () => {
    const router = renderPodium()
    await screen.findByTestId('podium-place-1')
    const navigate = vi.spyOn(router, 'navigate')
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    })

    fireEvent.click(screen.getByTestId('podium-exit-button'))
    // What the real exitFullscreen() does next: the browser leaves and says so.
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
    const toLeaderboard = navigate.mock.calls.filter(
      ([options]) => (options as { search?: { from?: string } }).search?.from === 'podium',
    )
    expect(toLeaderboard).toHaveLength(1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/leaderboard'))
  })

  it('leaves on Escape without calling exitFullscreen when nothing is fullscreen', async () => {
    const router = renderPodium()
    await screen.findByTestId('podium-place-1')

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    await waitFor(() => expect(router.state.location.pathname).toBe('/leaderboard'))
    expect(document.exitFullscreen).not.toHaveBeenCalled()
  })
})
