import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      teams: Object.assign(vi.fn(), {
        $get: vi.fn(),
        ':id': { $patch: vi.fn(), $delete: vi.fn() },
        members: {
          ':userId': {
            $delete: vi.fn(),
            move: { $post: vi.fn() },
          },
        },
      }),
    },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedTeamsGet = vi.mocked(api.organizer.teams.$get)
const mockedTeamsPatch = vi.mocked(api.organizer.teams[':id'].$patch)
const mockedTeamsDelete = vi.mocked(api.organizer.teams[':id'].$delete)
const mockedMemberDelete = vi.mocked(api.organizer.teams.members[':userId'].$delete)
const mockedMemberMove = vi.mocked(api.organizer.teams.members[':userId'].move.$post)

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

function organizerTeamsList(overrides: Record<string, unknown> = {}) {
  return {
    maxTeamSize: 3,
    teams: [
      {
        id: 'team-1',
        name: 'Blockly Busters',
        frozen: false,
        slotsAvailable: 1,
        members: [
          { userId: 'u1', email: 'creator@edu.pucrs.br', university: 'pucrs', role: 'participant' },
          { userId: 'u2', email: 'cross@merida.edu.mx', university: 'merida', role: 'participant' },
        ],
      },
      {
        id: 'team-2',
        name: 'Frozen Squad',
        frozen: true,
        slotsAvailable: 0,
        members: [
          { userId: 'u3', email: 'a@edu.pucrs.br', university: 'pucrs', role: 'participant' },
        ],
      },
    ],
    ...overrides,
  }
}

function renderScreen() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/teams'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedTeamsGet.mockReset()
  mockedTeamsPatch.mockReset()
  mockedTeamsDelete.mockReset()
  mockedMemberDelete.mockReset()
  mockedMemberMove.mockReset()
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('OrganizerTeamsScreen', () => {
  it('shows a loading state while the listing is pending', async () => {
    mockedTeamsGet.mockReturnValue(new Promise(() => {}))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-loading')).toBeDefined())
  })

  it('shows an error with retry when the listing fails', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(500, {}))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-error')).toBeDefined())

    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    fireEvent.click(screen.getByTestId('team-moderation-error-retry'))

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
  })

  it('renders every team with its members, frozen state and roles', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    expect(screen.getByTestId('team-moderation-name-team-1').textContent).toContain(
      'Blockly Busters',
    )
    expect(screen.queryByTestId('team-moderation-frozen-team-1')).toBeNull()
    expect(screen.getByTestId('team-moderation-member-row-u1').textContent).toContain(
      'creator@edu.pucrs.br',
    )

    expect(screen.getByTestId('team-moderation-card-team-2')).toBeDefined()
    expect(screen.getByTestId('team-moderation-frozen-team-2')).toBeDefined()
    expect(screen.getByTestId('team-moderation-remove-team-action-team-2')).toBeDefined()
  })
})
