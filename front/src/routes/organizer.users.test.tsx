import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      users: { $get: vi.fn() },
      teams: { $get: vi.fn() },
    },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedUsersGet = vi.mocked(api.organizer.users.$get)
const mockedTeamsGet = vi.mocked(api.organizer.teams.$get)

const organizerUser: SessionUser = {
  id: 'org-1',
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

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'ada@edu.pucrs.br',
    role: 'participant',
    university: 'pucrs',
    active: true,
    team: { id: 'team-1', name: 'Blockly Busters' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const defaultList = {
  items: [
    user(),
    user({
      id: 'u2',
      email: 'grace@merida.edu.mx',
      university: 'merida',
      role: 'organizer',
      team: null,
      active: false,
    }),
  ],
  total: 2,
}

const teamsList = {
  maxTeamSize: 3,
  teams: [
    { id: 'team-1', name: 'Blockly Busters', frozen: false, slotsAvailable: 1, members: [] },
    { id: 'team-2', name: 'Frozen Squad', frozen: true, slotsAvailable: 0, members: [] },
  ],
}

function renderScreen() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/users'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

// The query the screen sent last. `limit`/`offset` go out as numbers — the
// listing schema coerces them, so the typed client takes them unstringified.
function lastQuery() {
  const call = mockedUsersGet.mock.calls.at(-1)?.[0] as
    | { query: Record<string, string | number | undefined> }
    | undefined
  if (!call) throw new Error('expected the users listing to have been queried')
  return call.query
}

beforeEach(() => {
  mockedUsersGet.mockReset()
  mockedUsersGet.mockResolvedValue(jsonResponse(200, defaultList))
  mockedTeamsGet.mockReset()
  mockedTeamsGet.mockResolvedValue(jsonResponse(200, teamsList))
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('OrganizerUsersScreen', () => {
  it('shows a loading state while the listing is pending', async () => {
    mockedUsersGet.mockReturnValue(new Promise(() => {}))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('organizer-users-loading')).toBeDefined())
  })

  it('shows an error with retry when the listing fails', async () => {
    mockedUsersGet.mockResolvedValue(jsonResponse(500, {}))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('organizer-users-error')).toBeDefined())

    mockedUsersGet.mockResolvedValue(jsonResponse(200, defaultList))
    fireEvent.click(screen.getByTestId('organizer-users-error-retry'))

    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())
  })

  it('renders one row per user, with the team name and a dash when there is none', async () => {
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())
    expect(screen.getByTestId('organizer-users-row-u1').textContent).toContain('ada@edu.pucrs.br')
    expect(screen.getByTestId('organizer-users-row-u1').textContent).toContain('Blockly Busters')
    expect(screen.getByTestId('organizer-users-row-u2').textContent).toContain('—')
  })

  it('marks a deactivated user with a badge', async () => {
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('organizer-users-status-u2')).toBeDefined())
    expect(screen.getByTestId('organizer-users-status-u2').textContent).toBe('Desativado')
    expect(screen.getByTestId('organizer-users-status-u1').textContent).toBe('Ativo')
  })

  it('shows the empty state when nothing matches', async () => {
    mockedUsersGet.mockResolvedValue(jsonResponse(200, { items: [], total: 0 }))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('organizer-users-empty')).toBeDefined())
  })

  it('refetches with university=pucrs when the university filter changes', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())

    fireEvent.click(screen.getByTestId('organizer-users-filter-university'))
    fireEvent.click(await screen.findByRole('option', { name: 'PUCRS' }))

    await waitFor(() => expect(lastQuery().university).toBe('pucrs'))
  })

  it('refetches with the team filter picked from the team listing', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())

    fireEvent.click(screen.getByTestId('organizer-users-filter-team'))
    fireEvent.click(await screen.findByRole('option', { name: 'Frozen Squad' }))

    await waitFor(() => expect(lastQuery().teamId).toBe('team-2'))
  })

  it('sends the search term as q, only after the debounce', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())
    const before = mockedUsersGet.mock.calls.length

    fireEvent.change(screen.getByTestId('organizer-users-search-input'), {
      target: { value: 'grace' },
    })
    // Still the pre-typing query: the debounce has not elapsed yet.
    expect(mockedUsersGet.mock.calls.length).toBe(before)

    await waitFor(() => expect(lastQuery().q).toBe('grace'))
  })

  it('pages forward and back, disabling the edges', async () => {
    mockedUsersGet.mockResolvedValue(jsonResponse(200, { items: [user()], total: 21 }))
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())

    expect(screen.getByTestId('organizer-users-prev').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('organizer-users-range').textContent).toBe('1–20 de 21')

    fireEvent.click(screen.getByTestId('organizer-users-next'))

    await waitFor(() => expect(lastQuery().offset).toBe(20))
    await waitFor(() =>
      expect(screen.getByTestId('organizer-users-next').hasAttribute('disabled')).toBe(true),
    )
    expect(screen.getByTestId('organizer-users-range').textContent).toBe('21–21 de 21')
    expect(screen.getByTestId('organizer-users-prev').hasAttribute('disabled')).toBe(false)
  })

  it('goes back to the first page when a filter changes', async () => {
    mockedUsersGet.mockResolvedValue(jsonResponse(200, { items: [user()], total: 40 }))
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())

    fireEvent.click(screen.getByTestId('organizer-users-next'))
    await waitFor(() => expect(lastQuery().offset).toBe(20))

    fireEvent.click(screen.getByTestId('organizer-users-filter-role'))
    fireEvent.click(await screen.findByRole('option', { name: 'Organizador' }))

    await waitFor(() => expect(lastQuery().offset).toBe(0))
    expect(lastQuery().role).toBe('organizer')
  })
})
