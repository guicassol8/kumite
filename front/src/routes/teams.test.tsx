import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    teams: Object.assign(vi.fn(), {
      $get: vi.fn(),
      $post: vi.fn(),
      leave: { $post: vi.fn() },
      ':id': { join: { $post: vi.fn() } },
    }),
    me: { $get: vi.fn() },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedList = vi.mocked(api.teams.$get)

const participant: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const organizer: SessionUser = {
  ...participant,
  id: 'u9',
  email: 'org@edu.pucrs.br',
  role: 'organizer',
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

type Member = { university: 'pucrs' | 'merida'; email: string | null }
type Team = {
  id: string
  name: string
  members: Member[]
  slotsAvailable: number
  frozen: boolean
  joinBlockedReason: 'already_in_team' | 'team_full' | 'mixed_lock_violation' | null
}

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1',
    name: 'Blockly Busters',
    members: [{ university: 'pucrs', email: null }],
    slotsAvailable: 2,
    frozen: false,
    joinBlockedReason: null,
    ...overrides,
  }
}

function envelope(
  overrides: Partial<{
    maxTeamSize: number
    mixingLocked: boolean
    myTeamId: string | null
    teams: Team[]
  }> = {},
) {
  return { maxTeamSize: 3, mixingLocked: false, myTeamId: null, teams: [team()], ...overrides }
}

function renderTeams() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/teams'] }),
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
  mockedList.mockReset()
  setSession(participant, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('TeamsScreen — listing', () => {
  it('shows a loading state, then the table with members and open slots', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          teams: [
            team({
              members: [
                { university: 'pucrs', email: null },
                { university: 'merida', email: null },
              ],
              slotsAvailable: 1,
            }),
          ],
        }),
      ),
    )
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-loading')).toBeDefined())

    await waitFor(() => expect(screen.getByTestId('teams-table')).toBeDefined())
    const row = screen.getByTestId('teams-row-t1')
    expect(row.textContent).toContain('Blockly Busters')
    expect(row.textContent).toContain('PUCRS')
    expect(row.textContent).toContain('Mérida')
    expect(row.textContent).toContain('1/3')
  })

  it('shows the empty state with a create shortcut when no team exists', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-empty')).toBeDefined())
    expect(screen.getByTestId('teams-empty-cta')).toBeDefined()
  })

  it('shows a recoverable error and refetches on retry', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(500, { error: 'internal' }))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-error')).toBeDefined())

    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope()))
    fireEvent.click(screen.getByTestId('teams-error-retry'))

    await waitFor(() => expect(screen.getByTestId('teams-table')).toBeDefined())
    expect(mockedList).toHaveBeenCalledTimes(2)
  })

  it('disables Join on a full team and says why', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(
        200,
        envelope({ teams: [team({ slotsAvailable: 0, joinBlockedReason: 'team_full' })] }),
      ),
    )
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-join-t1')).toBeDefined())
    expect(screen.getByTestId<HTMLButtonElement>('teams-join-t1').disabled).toBe(true)
    expect(screen.getByTestId('teams-row-t1').textContent).toContain('Time cheio')
    expect(screen.getByTestId('teams-row-t1').textContent).toContain('Cheio')
  })

  it('disables Join when the mixing lock would refuse it, and banners the lock', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          mixingLocked: true,
          teams: [team({ joinBlockedReason: 'mixed_lock_violation' })],
        }),
      ),
    )
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-join-t1')).toBeDefined())
    expect(screen.getByTestId<HTMLButtonElement>('teams-join-t1').disabled).toBe(true)
    expect(screen.getByTestId('teams-row-t1').textContent).toContain('Time de outra universidade')
    expect(screen.getByTestId('teams-mixing-locked-notice')).toBeDefined()
  })

  it('marks the viewer own team and offers no Join for it', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ myTeamId: 't1' })))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-your-team-badge')).toBeDefined())
    expect(screen.queryByTestId('teams-join-t1')).toBeNull()
  })

  it('renders no actions at all for an organizer', async () => {
    setSession(organizer, 'tok-9')
    mockedList.mockResolvedValue(jsonResponse(200, envelope()))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-table')).toBeDefined())
    expect(screen.queryByTestId('teams-join-t1')).toBeNull()
    expect(screen.queryByTestId('teams-create-open')).toBeNull()
  })
})
