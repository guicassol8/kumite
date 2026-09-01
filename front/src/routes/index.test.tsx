import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    health: { $get: vi.fn() },
    teams: Object.assign(vi.fn(), { $get: vi.fn() }),
    me: { $get: vi.fn() },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedHealth = vi.mocked(api.health.$get)
const mockedTeams = vi.mocked(api.teams.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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
  mockedHealth.mockResolvedValue(jsonResponse(200, { status: 'ok' }))
  clearSession('manual')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('Home', () => {
  it('does not show the notice banner by default', async () => {
    renderHome()

    await waitFor(() => expect(screen.getByTestId('api-status')).toBeDefined())
    expect(screen.queryByTestId('home-notice-banner')).toBeNull()
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

    await waitFor(() => expect(screen.getByTestId('api-status')).toBeDefined())
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
