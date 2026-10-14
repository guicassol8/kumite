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

// Rendered authenticated, so the real `__root` (#217) always opens the
// shared round SSE stream.
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
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
  name: 'Org',
  role: 'organizer',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
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
          {
            userId: 'u1',
            email: 'creator@edu.pucrs.br',
            name: 'Ada Lovelace',
            university: 'pucrs',
            role: 'participant',
          },
          {
            userId: 'u2',
            email: 'cross@merida.edu.mx',
            name: null,
            university: 'merida',
            role: 'participant',
          },
        ],
      },
      {
        id: 'team-2',
        name: 'Frozen Squad',
        frozen: true,
        slotsAvailable: 0,
        members: [
          {
            userId: 'u3',
            email: 'a@edu.pucrs.br',
            name: 'Alan Turing',
            university: 'pucrs',
            role: 'participant',
          },
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

  it('shows the member name, and a dash for an account that has none (#122)', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    // Below 768px each cell repeats its column header as a card label, so the
    // cell reads "NomeAda Lovelace"; the value is the last span in the cell.
    const named = screen.getByTestId('team-moderation-member-row-u1')
    expect(named.querySelectorAll('td')[0]?.lastElementChild?.textContent).toBe('Ada Lovelace')
    const legacy = screen.getByTestId('team-moderation-member-row-u2')
    expect(legacy.querySelectorAll('td')[0]?.lastElementChild?.textContent).toBe('—')
    expect(legacy.textContent).toContain('cross@merida.edu.mx')
  })

  it('renames a team inline and invalidates the listing', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedTeamsPatch.mockResolvedValue(jsonResponse(200, { id: 'team-1', name: 'New Name' }))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-rename-start-team-1'))
    fireEvent.change(screen.getByTestId('team-moderation-rename-input-team-1'), {
      target: { value: 'New Name' },
    })

    mockedTeamsGet.mockResolvedValue(
      jsonResponse(
        200,
        organizerTeamsList({ teams: [{ ...organizerTeamsList().teams[0], name: 'New Name' }] }),
      ),
    )
    fireEvent.click(screen.getByTestId('team-moderation-rename-save-team-1'))

    await waitFor(() =>
      expect(mockedTeamsPatch).toHaveBeenCalledWith({
        param: { id: 'team-1' },
        json: { name: 'New Name' },
      }),
    )
    await waitFor(() => expect(mockedTeamsGet).toHaveBeenCalledTimes(2))
  })

  it('maps a 409 rename conflict onto an inline field error', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedTeamsPatch.mockResolvedValue(jsonResponse(409, { error: 'name_taken' }))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-rename-start-team-1'))
    fireEvent.change(screen.getByTestId('team-moderation-rename-input-team-1'), {
      target: { value: 'Frozen Squad' },
    })
    fireEvent.click(screen.getByTestId('team-moderation-rename-save-team-1'))

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-rename-error-team-1')).toBeDefined(),
    )
    expect(screen.getByTestId('team-moderation-rename-input-team-1')).toBeDefined()
  })

  it('refuses a whitespace-only rename without calling the API', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-rename-start-team-1'))
    fireEvent.change(screen.getByTestId('team-moderation-rename-input-team-1'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByTestId('team-moderation-rename-save-team-1'))

    const error = await screen.findByTestId('team-moderation-rename-error-team-1')
    expect(error.textContent).toContain('Informe o nome do time')
    expect(mockedTeamsPatch).not.toHaveBeenCalled()
  })

  it('sends the normalized name on rename', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedTeamsPatch.mockResolvedValue(jsonResponse(200, { id: 'team-1', name: 'New Name' }))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-rename-start-team-1'))
    fireEvent.change(screen.getByTestId('team-moderation-rename-input-team-1'), {
      target: { value: '  New   Name  ' },
    })
    fireEvent.click(screen.getByTestId('team-moderation-rename-save-team-1'))

    await waitFor(() =>
      expect(mockedTeamsPatch).toHaveBeenCalledWith({
        param: { id: 'team-1' },
        json: { name: 'New Name' },
      }),
    )
  })

  it('maps a 422 about the name onto the same inline field error', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedTeamsPatch.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: { body: [{ path: 'name', message: 'Too big', code: 'too_big' }] },
      }),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-rename-start-team-1'))
    fireEvent.change(screen.getByTestId('team-moderation-rename-input-team-1'), {
      target: { value: 'Another Name' },
    })
    fireEvent.click(screen.getByTestId('team-moderation-rename-save-team-1'))

    const error = await screen.findByTestId('team-moderation-rename-error-team-1')
    // The catalog string, never `issue.message` — kata returns zod's English.
    expect(error.textContent).toContain('no máximo 40 caracteres')
  })

  // #200.4: removing, moving or leaving never deletes the team, so a team
  // with nobody in it is a normal state — not a card with a bare header row.
  it('says a team has no members instead of drawing an empty table', async () => {
    mockedTeamsGet.mockResolvedValue(
      jsonResponse(
        200,
        organizerTeamsList({
          teams: [{ ...organizerTeamsList().teams[0], slotsAvailable: 3, members: [] }],
        }),
      ),
    )
    renderScreen()

    const empty = await screen.findByTestId('team-moderation-members-empty-team-1')
    expect(empty.textContent).toBe('Este time não tem integrantes.')
    expect(screen.queryByTestId('team-moderation-members-team-1')).toBeNull()
    expect(screen.getByTestId('team-moderation-member-count-team-1').textContent).toBe('0')
    expect(screen.getByTestId('team-moderation-remove-team-action-team-1')).toBeDefined()
  })

  // Achado #10 (Acceptance 4): teams stored blank before #185 used to render a
  // card with no title at all, so the organizer could not even tell two of
  // them apart — which is exactly what the id suffix is here to fix.
  it('labels blank-named teams distinguishably, each with its rename control', async () => {
    mockedTeamsGet.mockResolvedValue(
      jsonResponse(
        200,
        organizerTeamsList({
          teams: [
            {
              ...organizerTeamsList().teams[0],
              id: 'aaaaaaaa-1111-2222-3333-444444444444',
              name: '   ',
            },
            {
              ...organizerTeamsList().teams[1],
              id: 'bbbbbbbb-1111-2222-3333-444444444444',
              name: '',
            },
          ],
        }),
      ),
    )
    renderScreen()

    const first = await screen.findByTestId(
      'team-moderation-name-aaaaaaaa-1111-2222-3333-444444444444',
    )
    const second = await screen.findByTestId(
      'team-moderation-name-bbbbbbbb-1111-2222-3333-444444444444',
    )
    expect(first.textContent).toContain('Time sem nome')
    expect(second.textContent).toContain('Time sem nome')
    expect(first.textContent).not.toEqual(second.textContent)
    expect(first.textContent).toContain('aaaaaaaa')
    expect(second.textContent).toContain('bbbbbbbb')
    expect(
      screen.getByTestId('team-moderation-rename-start-aaaaaaaa-1111-2222-3333-444444444444'),
    ).toBeDefined()
    expect(
      screen.getByTestId('team-moderation-rename-start-bbbbbbbb-1111-2222-3333-444444444444'),
    ).toBeDefined()
  })

  it('moves a member to another team and disables a full destination option', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedMemberMove.mockResolvedValue(jsonResponse(204, undefined))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-move-select-u1')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-move-select-u1'))

    const fullOption = await screen.findByRole('option', { name: 'Frozen Squad' })
    expect(fullOption.getAttribute('data-disabled')).not.toBeNull()

    fireEvent.click(fullOption)
    expect(screen.getByTestId('team-moderation-move-action-u1').hasAttribute('disabled')).toBe(true)
  })

  it('maps move errors (team_full, team_not_found) onto an inline row error', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedMemberMove.mockResolvedValueOnce(jsonResponse(409, { error: 'team_full' }))
    mockedMemberMove.mockResolvedValueOnce(jsonResponse(404, { error: 'team_not_found' }))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-member-row-u3')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-move-select-u3'))
    fireEvent.click(await screen.findByRole('option', { name: 'Blockly Busters' }))
    fireEvent.click(screen.getByTestId('team-moderation-move-action-u3'))

    await waitFor(() => expect(screen.getByTestId('team-moderation-move-error-u3')).toBeDefined())

    fireEvent.click(screen.getByTestId('team-moderation-move-select-u3'))
    fireEvent.click(await screen.findByRole('option', { name: 'Blockly Busters' }))
    fireEvent.click(screen.getByTestId('team-moderation-move-action-u3'))

    await waitFor(() => expect(mockedMemberMove).toHaveBeenCalledTimes(2))
  })

  it('removes a member after confirming the dialog', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedMemberDelete.mockResolvedValue(jsonResponse(204, undefined))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-member-action-u1')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-member-action-u1'))

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-member-confirm-u1')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-member-confirm-confirm-u1'))

    await waitFor(() =>
      expect(mockedMemberDelete).toHaveBeenCalledWith({ param: { userId: 'u1' } }),
    )
    await waitFor(() => expect(mockedTeamsGet).toHaveBeenCalledTimes(2))
  })

  it('removes a team after confirming the dialog, even when frozen', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedTeamsDelete.mockResolvedValue(jsonResponse(204, undefined))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-team-action-team-2')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-team-action-team-2'))

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-team-confirm-team-2')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-team-confirm-confirm-team-2'))

    await waitFor(() => expect(mockedTeamsDelete).toHaveBeenCalledWith({ param: { id: 'team-2' } }))
    await waitFor(() => expect(mockedTeamsGet).toHaveBeenCalledTimes(2))
  })

  it('shows an inline error and does not refresh the list when removing a member fails', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedMemberDelete.mockResolvedValue(jsonResponse(404, { error: 'not_found' }))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-member-action-u1')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-member-action-u1'))
    fireEvent.click(await screen.findByTestId('team-moderation-remove-member-confirm-confirm-u1'))

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-member-error-u1')).toBeDefined(),
    )
    expect(mockedTeamsGet).toHaveBeenCalledTimes(1)
  })

  it('shows an inline error and does not refresh the list when removing a team fails', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedTeamsDelete.mockResolvedValue(jsonResponse(404, { error: 'not_found' }))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-team-action-team-2')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-team-action-team-2'))
    fireEvent.click(await screen.findByTestId('team-moderation-remove-team-confirm-confirm-team-2'))

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-team-error-team-2')).toBeDefined(),
    )
    expect(mockedTeamsGet).toHaveBeenCalledTimes(1)
  })

  // #195 (achado #27): a dead network rejects `mutateAsync` instead of
  // answering. All four actions are fired from onClick without an await, so
  // without a catch the row stayed silent and the rejection went unhandled —
  // which vitest itself reports as a failed run.
  describe('a dead network', () => {
    it('reports a failed rename inline and keeps the editor open', async () => {
      mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
      mockedTeamsPatch.mockRejectedValue(new Error('network down'))
      renderScreen()

      await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
      fireEvent.click(screen.getByTestId('team-moderation-rename-start-team-1'))
      fireEvent.change(screen.getByTestId('team-moderation-rename-input-team-1'), {
        target: { value: 'New Name' },
      })
      fireEvent.click(screen.getByTestId('team-moderation-rename-save-team-1'))

      const alert = await screen.findByTestId('team-moderation-rename-error-team-1')
      expect(alert.textContent).toContain('Não foi possível salvar')
      expect(screen.getByTestId('team-moderation-rename-input-team-1')).toBeDefined()
      expect(mockedTeamsGet).toHaveBeenCalledTimes(1)
    })

    it('reports a failed move inline', async () => {
      mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
      mockedMemberMove.mockRejectedValue(new Error('network down'))
      renderScreen()

      await waitFor(() => expect(screen.getByTestId('team-moderation-member-row-u3')).toBeDefined())
      fireEvent.click(screen.getByTestId('team-moderation-move-select-u3'))
      fireEvent.click(await screen.findByRole('option', { name: 'Blockly Busters' }))
      fireEvent.click(screen.getByTestId('team-moderation-move-action-u3'))

      const alert = await screen.findByTestId('team-moderation-move-error-u3')
      expect(alert.textContent).toContain('Não foi possível mover este integrante')
      expect(mockedTeamsGet).toHaveBeenCalledTimes(1)
    })

    it('reports a failed member removal inline', async () => {
      mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
      mockedMemberDelete.mockRejectedValue(new Error('network down'))
      renderScreen()

      await waitFor(() =>
        expect(screen.getByTestId('team-moderation-remove-member-action-u1')).toBeDefined(),
      )
      fireEvent.click(screen.getByTestId('team-moderation-remove-member-action-u1'))
      fireEvent.click(await screen.findByTestId('team-moderation-remove-member-confirm-confirm-u1'))

      const alert = await screen.findByTestId('team-moderation-remove-member-error-u1')
      expect(alert.textContent).toContain('Não foi possível remover este integrante')
      expect(mockedTeamsGet).toHaveBeenCalledTimes(1)
    })

    it('reports a failed team removal inline', async () => {
      mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
      mockedTeamsDelete.mockRejectedValue(new Error('network down'))
      renderScreen()

      await waitFor(() =>
        expect(screen.getByTestId('team-moderation-remove-team-action-team-2')).toBeDefined(),
      )
      fireEvent.click(screen.getByTestId('team-moderation-remove-team-action-team-2'))
      fireEvent.click(
        await screen.findByTestId('team-moderation-remove-team-confirm-confirm-team-2'),
      )

      const alert = await screen.findByTestId('team-moderation-remove-team-error-team-2')
      expect(alert.textContent).toContain('Não foi possível remover este time')
      expect(mockedTeamsGet).toHaveBeenCalledTimes(1)
    })
  })

  it('does not blame a missing destination team for an undeclared move status', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    mockedMemberMove.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-member-row-u3')).toBeDefined())
    fireEvent.click(screen.getByTestId('team-moderation-move-select-u3'))
    fireEvent.click(await screen.findByRole('option', { name: 'Blockly Busters' }))
    fireEvent.click(screen.getByTestId('team-moderation-move-action-u3'))

    const alert = await screen.findByTestId('team-moderation-move-error-u3')
    expect(alert.textContent).toContain('Não foi possível mover este integrante')
    expect(alert.textContent).not.toContain('não existe mais')
  })
})

// #223: the moderation cards are a reading surface, so they move to the panel
// table like every other listing. The overlays they open (remove team, remove
// member) belong to #233 and are untouched here.
describe('organizer teams — identity (#223)', () => {
  it('renders each member list as the panel table, never inside a scrolling wrapper', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-members-team-1')).toBeDefined())
    const table = screen.getByTestId('team-moderation-members-team-1')
    expect(table.className).toContain('table-fixed')
    expect(table.querySelector('th')?.className).toContain('font-display')

    // The member list inside a card was the worst overflow on a phone.
    let node: HTMLElement | null = table
    while (node) {
      expect(node.className).not.toContain('overflow-x')
      node = node.parentElement
    }
  })

  it('shows the member count in the card header in tabular display numerals', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    const count = screen.getByTestId('team-moderation-member-count-team-1')
    expect(count.className).toContain('font-display')
    expect(count.className).toContain('tabular-nums')
    expect(count.getAttribute('aria-label')).toBe('Integrantes')
  })

  it('keeps the destructive team action as an outline, and every row testid', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('team-moderation-card-team-1')).toBeDefined())
    // This issue only *consumes* the crimson outline #216 gave the button.
    expect(screen.getByTestId('team-moderation-remove-team-action-team-1')).toBeDefined()
    expect(screen.getByTestId('team-moderation-move-select-u1')).toBeDefined()
    expect(screen.getByTestId('team-moderation-move-action-u1')).toBeDefined()
    expect(screen.getByTestId('team-moderation-remove-member-action-u1')).toBeDefined()
  })
})

/** The element's classes as tokens — a substring match on the whole string
 * hits things like `aria-invalid:border-destructive` by accident. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

/** The identity's destructive action: crimson draws the border and the text,
 * never the surface (docs/design/identity.md § 3, Regra 1). */
function expectCrimsonOutline(button: Element) {
  const classes = classesOf(button)
  expect(classes).toContain('border-destructive')
  expect(classes).toContain('text-destructive')
  expect(classes).not.toContain('bg-destructive')
  expect(classes).not.toContain('bg-primary')
}

// #233 — the two team-moderation overlays.
describe('organizer teams — overlays in the panel identity (#233)', () => {
  it('puts "Remover integrante" in crimson outline, under an H2 title', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-member-action-u1')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-member-action-u1'))

    const confirm = await screen.findByTestId('team-moderation-remove-member-confirm-confirm-u1')
    expectCrimsonOutline(confirm)
    expect(document.querySelector('[data-slot="alert-dialog-title"]')?.className).toContain(
      'font-display',
    )
  })

  it('puts "Remover time" in crimson outline, matching its own row trigger', async () => {
    mockedTeamsGet.mockResolvedValue(jsonResponse(200, organizerTeamsList()))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('team-moderation-remove-team-action-team-2')).toBeDefined(),
    )
    fireEvent.click(screen.getByTestId('team-moderation-remove-team-action-team-2'))

    const confirm = await screen.findByTestId('team-moderation-remove-team-confirm-confirm-team-2')
    expectCrimsonOutline(confirm)
  })
})
