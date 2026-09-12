import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      users: {
        $get: vi.fn(),
        ':id': {
          promote: { $post: vi.fn() },
          demote: { $post: vi.fn() },
          deactivate: { $post: vi.fn() },
          reactivate: { $post: vi.fn() },
          'reset-password': { $post: vi.fn() },
        },
      },
      teams: { $get: vi.fn() },
    },
  },
}))

// Rendered authenticated, so the real `__root` (#217) always opens the
// shared round SSE stream.
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedUsersGet = vi.mocked(api.organizer.users.$get)
const mockedTeamsGet = vi.mocked(api.organizer.teams.$get)
const mockedPromote = vi.mocked(api.organizer.users[':id'].promote.$post)
const mockedDemote = vi.mocked(api.organizer.users[':id'].demote.$post)
const mockedDeactivate = vi.mocked(api.organizer.users[':id'].deactivate.$post)
const mockedReactivate = vi.mocked(api.organizer.users[':id'].reactivate.$post)
const mockedResetPassword = vi.mocked(api.organizer.users[':id']['reset-password'].$post)

const organizerUser: SessionUser = {
  id: 'org-1',
  email: 'org@edu.pucrs.br',
  name: 'Org',
  role: 'organizer',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
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
    name: 'Ada Lovelace',
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
    // No name: an account created before the #122 migration.
    user({
      id: 'u2',
      email: 'grace@merida.edu.mx',
      name: null,
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
  for (const action of [mockedPromote, mockedDemote, mockedDeactivate, mockedReactivate]) {
    action.mockReset()
    action.mockResolvedValue(jsonResponse(200, user()))
  }
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

  it('renders the name column, with a dash for an account that has none (#122)', async () => {
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('organizer-users-row-u1')).toBeDefined())
    expect(screen.getByTestId('organizer-users-row-u1').textContent).toContain('Ada Lovelace')
    // u2 has name: null and a team: null — the dash covers both cells, so the
    // check that matters is that the email is still the only identity shown.
    const legacyRow = screen.getByTestId('organizer-users-row-u2')
    expect(legacyRow.textContent).toContain('grace@merida.edu.mx')
    expect(legacyRow.querySelectorAll('td')[0]?.textContent).toBe('—')
    expect(screen.getByText('Nome')).toBeDefined()
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
  it('promotes a participant straight away and refreshes the listing', async () => {
    renderScreen()
    await screen.findByTestId('organizer-users-row-u1')
    const before = mockedUsersGet.mock.calls.length

    fireEvent.click(screen.getByTestId('organizer-users-promote-u1'))

    await waitFor(() => expect(mockedPromote).toHaveBeenCalledWith({ param: { id: 'u1' } }))
    await waitFor(() => expect(mockedUsersGet.mock.calls.length).toBeGreaterThan(before))
  })

  it('reactivates a deactivated user straight away', async () => {
    renderScreen()
    await screen.findByTestId('organizer-users-row-u2')

    fireEvent.click(screen.getByTestId('organizer-users-reactivate-u2'))

    await waitFor(() => expect(mockedReactivate).toHaveBeenCalledWith({ param: { id: 'u2' } }))
  })

  it('deactivates only once the confirmation is accepted', async () => {
    renderScreen()
    await screen.findByTestId('organizer-users-row-u1')

    fireEvent.click(screen.getByTestId('organizer-users-deactivate-u1'))
    fireEvent.click(await screen.findByTestId('organizer-users-confirm-cancel-u1'))
    expect(mockedDeactivate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('organizer-users-deactivate-u1'))
    fireEvent.click(await screen.findByTestId('organizer-users-confirm-confirm-u1'))
    await waitFor(() => expect(mockedDeactivate).toHaveBeenCalledWith({ param: { id: 'u1' } }))
  })

  it('demotes only once the confirmation is accepted', async () => {
    renderScreen()
    await screen.findByTestId('organizer-users-row-u2')

    fireEvent.click(screen.getByTestId('organizer-users-demote-u2'))
    fireEvent.click(await screen.findByTestId('organizer-users-confirm-confirm-u2'))

    await waitFor(() => expect(mockedDemote).toHaveBeenCalledWith({ param: { id: 'u2' } }))
  })

  it('disables both actions on the signed-in organizer own row', async () => {
    mockedUsersGet.mockResolvedValue(
      jsonResponse(200, {
        items: [user({ id: 'org-1', email: organizerUser.email, role: 'organizer', team: null })],
        total: 1,
      }),
    )
    renderScreen()
    await screen.findByTestId('organizer-users-row-org-1')

    expect(screen.getByTestId('organizer-users-self-tooltip-org-1')).toBeTruthy()
    expect((screen.getByTestId('organizer-users-demote-org-1') as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(
      (screen.getByTestId('organizer-users-deactivate-org-1') as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('shows a generic failure in the row when the request never lands', async () => {
    mockedPromote.mockRejectedValue(new Error('network down'))
    renderScreen()
    await screen.findByTestId('organizer-users-row-u1')

    fireEvent.click(screen.getByTestId('organizer-users-promote-u1'))

    const alert = await screen.findByTestId('organizer-users-action-error-u1')
    expect(alert.textContent).toContain('Não foi possível concluir a ação.')
  })

  it('shows the refusal in the row when the API answers 403', async () => {
    mockedDeactivate.mockResolvedValue(jsonResponse(403, { error: 'cannot_deactivate_self' }))
    renderScreen()
    await screen.findByTestId('organizer-users-row-u1')

    fireEvent.click(screen.getByTestId('organizer-users-deactivate-u1'))
    fireEvent.click(await screen.findByTestId('organizer-users-confirm-confirm-u1'))

    const alert = await screen.findByTestId('organizer-users-action-error-u1')
    expect(alert.textContent).toContain('própria conta')
  })
})

describe('organizer users — password reset (#143)', () => {
  async function openDialog() {
    renderScreen()
    await screen.findByTestId('organizer-users-row-u1')
    fireEvent.click(screen.getByTestId('organizer-users-reset-password-u1'))
    return screen.findByTestId('organizer-users-reset-password-dialog-u1')
  }

  function typeAdminPassword(value: string) {
    fireEvent.change(screen.getByTestId('organizer-users-reset-password-admin-password-input-u1'), {
      target: { value },
    })
  }

  it('sends the organizer password and shows the temporary one', async () => {
    mockedResetPassword.mockResolvedValue(
      jsonResponse(200, { temporaryPassword: 'k7fq-3nrv-9wzt' }),
    )
    await openDialog()

    typeAdminPassword('organizer-secret')
    fireEvent.click(screen.getByTestId('organizer-users-reset-password-submit-u1'))

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith({
        param: { id: 'u1' },
        json: { adminPassword: 'organizer-secret' },
      })
    })
    const value = await screen.findByTestId('organizer-users-reset-password-result-value-u1')
    expect(value.textContent).toBe('k7fq-3nrv-9wzt')
  })

  it('shows one message for a 403 and no password at all', async () => {
    mockedResetPassword.mockResolvedValue(jsonResponse(403, { error: 'invalid_admin_password' }))
    await openDialog()

    typeAdminPassword('wrong')
    fireEvent.click(screen.getByTestId('organizer-users-reset-password-submit-u1'))

    const alert = await screen.findByTestId('organizer-users-reset-password-error-u1')
    // The API refuses to say whether it was the password or the ceiling, and
    // the UI repeats that refusal instead of guessing.
    expect(alert.textContent).toContain('tentativas demais')
    expect(screen.queryByTestId('organizer-users-reset-password-result-u1')).toBeNull()
  })

  it('does not keep the temporary password around after the dialog closes', async () => {
    mockedResetPassword.mockResolvedValue(
      jsonResponse(200, { temporaryPassword: 'k7fq-3nrv-9wzt' }),
    )
    await openDialog()

    typeAdminPassword('organizer-secret')
    fireEvent.click(screen.getByTestId('organizer-users-reset-password-submit-u1'))
    await screen.findByTestId('organizer-users-reset-password-result-value-u1')

    fireEvent.click(screen.getByTestId('organizer-users-reset-password-close-u1'))
    await waitFor(() => {
      expect(screen.queryByTestId('organizer-users-reset-password-result-value-u1')).toBeNull()
    })

    // Shown once means gone from the page, not merely hidden behind a closed
    // dialog: it lives in component state and nowhere else.
    expect(document.body.textContent).not.toContain('k7fq-3nrv-9wzt')

    // And the next open starts over at step one — Radix tears the dialog down
    // across a few frames, so the reopen has to be retried rather than fired
    // once into a half-unmounted tree.
    await waitFor(
      () => {
        fireEvent.click(screen.getByTestId('organizer-users-reset-password-u1'))
        const input = screen.getByTestId(
          'organizer-users-reset-password-admin-password-input-u1',
        ) as HTMLInputElement
        expect(input.value).toBe('')
      },
      { timeout: 3000 },
    )
  })

  it('is disabled on an organizer row, with its own explanation', async () => {
    renderScreen()
    await screen.findByTestId('organizer-users-row-u2')

    expect(
      (screen.getByTestId('organizer-users-reset-password-u2') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByTestId('organizer-users-reset-password-tooltip-u2')).toBeTruthy()
    expect(
      screen.getByTestId('organizer-users-reset-password-u2').getAttribute('aria-label'),
    ).toContain('participantes')
  })

  it("is disabled on the caller's own row, under the existing self tooltip", async () => {
    mockedUsersGet.mockResolvedValue(
      jsonResponse(200, {
        items: [user({ id: 'org-1', email: organizerUser.email, role: 'organizer', team: null })],
        total: 1,
      }),
    )
    renderScreen()
    await screen.findByTestId('organizer-users-row-org-1')

    expect(
      (screen.getByTestId('organizer-users-reset-password-org-1') as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByTestId('organizer-users-self-tooltip-org-1')).toBeTruthy()
    // The self case keeps the tooltip the other two buttons already share, so
    // the organizer-only one must not also appear on this row.
    expect(screen.queryByTestId('organizer-users-reset-password-tooltip-org-1')).toBeNull()
  })
})
