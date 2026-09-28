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

// Rendered authenticated, so the real `__root` (#217) always opens the
// shared round SSE stream.
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedList = vi.mocked(api.teams.$get)
const mockedLeave = vi.mocked(api.teams.leave.$post)
const mockedCreate = vi.mocked(api.teams.$post)
const mockedJoin = vi.mocked(api.teams[':id'].join.$post)

const participant: SessionUser = {
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

type Member = { university: 'pucrs' | 'merida'; email: string | null; name: string | null }
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
    members: [{ university: 'pucrs', email: null, name: null }],
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
  mockedLeave.mockReset()
  mockedCreate.mockReset()
  mockedJoin.mockReset()
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
                { university: 'pucrs', email: null, name: null },
                { university: 'merida', email: null, name: null },
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
    expect(screen.getByTestId('teams-join-t1').textContent).toBe('Cheio')
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

describe('TeamsScreen — my team panel', () => {
  const myTeam = () =>
    envelope({
      myTeamId: 't1',
      teams: [
        team({
          members: [
            { university: 'pucrs', email: participant.email, name: 'Ada Lovelace' },
            // No name: a teammate whose account predates #122.
            { university: 'merida', email: 'grace@merida.edu.mx', name: null },
          ],
          slotsAvailable: 1,
        }),
      ],
    })

  it('stays hidden while the viewer has no team', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope()))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-table')).toBeDefined())
    expect(screen.queryByTestId('my-team-panel')).toBeNull()
  })

  it('lists teammates with their emails and marks the viewer', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, myTeam()))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('my-team-panel')).toBeDefined())
    expect(screen.getByTestId('my-team-name').textContent).toContain('Blockly Busters')
    expect(screen.getByTestId('my-team-member-0').textContent).toContain(participant.email)
    // Name in front of the email for whoever has one (#122)…
    expect(screen.getByTestId('my-team-member-0').textContent).toContain('Ada Lovelace')
    expect(screen.getByTestId('my-team-member-0').textContent).toContain('(você)')
    // …and the email alone for the teammate that has none.
    expect(screen.getByTestId('my-team-member-1').textContent).toContain('grace@merida.edu.mx')
    expect(screen.getByTestId('my-team-member-1').textContent).not.toContain('—')
    expect(screen.getByTestId('my-team-member-1').textContent).not.toContain('(você)')
  })

  it('leaves the team on confirm and refreshes the listing', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, myTeam()))
    mockedLeave.mockResolvedValue(jsonResponse(204, undefined))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('my-team-leave')).toBeDefined())
    fireEvent.click(screen.getByTestId('my-team-leave'))

    await waitFor(() => expect(screen.getByTestId('teams-leave-dialog')).toBeDefined())

    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope()))
    fireEvent.click(screen.getByTestId('teams-leave-confirm'))

    await waitFor(() => expect(mockedLeave).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('teams-action-error')).toBeNull()
  })

  // #195 (achado #26): the leave used to discard the response, so every one of
  // these ended with the participant still on the team and nothing on screen.
  async function confirmLeave() {
    await waitFor(() => expect(screen.getByTestId('my-team-leave')).toBeDefined())
    fireEvent.click(screen.getByTestId('my-team-leave'))
    await waitFor(() => expect(screen.getByTestId('teams-leave-dialog')).toBeDefined())
    fireEvent.click(screen.getByTestId('teams-leave-confirm'))
  }

  it('says the roster is frozen when the API refuses the leave with 409 team_frozen', async () => {
    // The listing went stale: it still says "not frozen", so the button is
    // enabled and the API is the one that refuses.
    mockedList.mockResolvedValue(jsonResponse(200, myTeam()))
    mockedLeave.mockResolvedValue(
      jsonResponse(409, { error: 'team_frozen', message: 'This team has already submitted' }),
    )
    renderTeams()
    await confirmLeave()

    const alert = await screen.findByTestId('teams-action-error')
    expect(alert.textContent).toContain('formação está congelada')
    // The refetch is what brings the frozen notice and the disabled button.
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })

  it('says the participant is no longer on a team on 404 not_in_team', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, myTeam()))
    mockedLeave.mockResolvedValue(
      jsonResponse(404, { error: 'not_in_team', message: 'You do not belong to a team' }),
    )
    renderTeams()
    await confirmLeave()

    const alert = await screen.findByTestId('teams-action-error')
    expect(alert.textContent).toContain('Você não está mais em um time.')
  })

  it('reports a dead network instead of swallowing the rejection', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, myTeam()))
    mockedLeave.mockRejectedValue(new Error('network down'))
    renderTeams()
    await confirmLeave()

    const alert = await screen.findByTestId('teams-action-error')
    expect(alert.textContent).toContain('Não foi possível sair do time')
    expect(screen.getByTestId('my-team-panel')).toBeDefined()
  })

  it('clears a previous leave error once a retry succeeds', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, myTeam()))
    mockedLeave.mockRejectedValueOnce(new Error('network down'))
    renderTeams()
    await confirmLeave()
    await screen.findByTestId('teams-action-error')

    mockedLeave.mockResolvedValueOnce(jsonResponse(204, undefined))
    await confirmLeave()

    await waitFor(() => expect(mockedLeave).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByTestId('teams-action-error')).toBeNull())
  })

  it('keeps the roster frozen once the team has submitted', async () => {
    const frozen = myTeam()
    frozen.teams[0] = { ...frozen.teams[0], frozen: true } as Team
    mockedList.mockResolvedValue(jsonResponse(200, frozen))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('my-team-frozen-notice')).toBeDefined())
    expect(screen.getByTestId<HTMLButtonElement>('my-team-leave').disabled).toBe(true)
  })
})

describe('TeamsScreen — creating a team', () => {
  async function openCreateDialog() {
    await waitFor(() => expect(screen.getByTestId('teams-create-open')).toBeDefined())
    fireEvent.click(screen.getByTestId('teams-create-open'))
    await waitFor(() => expect(screen.getByTestId('teams-create-dialog')).toBeDefined())
  }

  function fillAndSubmit(name: string) {
    fireEvent.change(screen.getByTestId('teams-create-name-input'), { target: { value: name } })
    fireEvent.click(screen.getByTestId('teams-create-submit'))
  }

  it('hides the create action from someone who already has a team', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ myTeamId: 't1' })))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-table')).toBeDefined())
    expect(screen.queryByTestId('teams-create-open')).toBeNull()
  })

  it('creates the team, closes the dialog and refreshes the listing', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(jsonResponse(201, { id: 't2', name: 'Novo Time' }))
    renderTeams()
    await openCreateDialog()

    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope({ myTeamId: 't2' })))
    fillAndSubmit('Novo Time')

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith({ json: { name: 'Novo Time' } }))
    await waitFor(() => expect(screen.queryByTestId('teams-create-dialog')).toBeNull())
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })

  it('shows a duplicate name on the name field itself', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(jsonResponse(409, { error: 'name_taken', message: 'taken' }))
    renderTeams()
    await openCreateDialog()

    fillAndSubmit('Blockly Busters')

    const error = await screen.findByTestId('teams-create-name-error')
    expect(error.textContent).toContain('Já existe um time com esse nome')
    expect(screen.getByTestId('teams-create-dialog')).toBeDefined()
  })

  it('falls back to a form-level error on any other refusal', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(jsonResponse(409, { error: 'already_in_team', message: 'nope' }))
    renderTeams()
    await openCreateDialog()

    fillAndSubmit('Outro Time')

    expect(await screen.findByTestId('teams-create-form-error')).toBeDefined()
  })

  it('rejects an empty name before touching the API', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    renderTeams()
    await openCreateDialog()

    fireEvent.click(screen.getByTestId('teams-create-submit'))

    const error = await screen.findByTestId('teams-create-name-error')
    expect(error.textContent).toContain('Informe o nome do time')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  // Achado #10: "   " passed the front's min(1) and the back's, so a team with
  // no visible name was created and then rendered as an empty cell.
  it('rejects a whitespace-only name before touching the API', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    renderTeams()
    await openCreateDialog()

    fillAndSubmit('   ')

    const error = await screen.findByTestId('teams-create-name-error')
    expect(error.textContent).toContain('Informe o nome do time')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  // Achado #11: what reaches the API is the normalized name, so the unique
  // index sees "Os Dragoes " and "Os Dragoes" as the same team.
  it('sends the normalized name', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(jsonResponse(201, { id: 't2', name: 'Novo Time' }))
    renderTeams()
    await openCreateDialog()

    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope({ myTeamId: 't2' })))
    fillAndSubmit('  Novo   Time  ')

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith({ json: { name: 'Novo Time' } }))
  })

  it('puts a 422 about the name on the name field, not on the form', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: {
          body: [
            {
              path: 'name',
              message: 'String must contain at least 1 character(s)',
              code: 'too_small',
            },
          ],
        },
      }),
    )
    renderTeams()
    await openCreateDialog()

    fillAndSubmit('Novo Time')

    const error = await screen.findByTestId('teams-create-name-error')
    expect(error.textContent).toContain('Informe o nome do time')
    expect(screen.queryByTestId('teams-create-form-error')).toBeNull()
  })

  it('translates a 422 that names no known code', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: { body: [{ path: 'name', message: 'Invalid', code: 'custom' }] },
      }),
    )
    renderTeams()
    await openCreateDialog()

    fillAndSubmit('Novo Time')

    const error = await screen.findByTestId('teams-create-name-error')
    // The catalog string, never `issue.message` — kata hands back zod's own
    // English text.
    expect(error.textContent).toContain('Nome de time inválido')
  })

  it('falls back to a form-level error for a 422 that names no field', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    mockedCreate.mockResolvedValue(
      jsonResponse(422, { error: 'validation_failed', issues: { body: [] } }),
    )
    renderTeams()
    await openCreateDialog()

    fillAndSubmit('Novo Time')

    expect(await screen.findByTestId('teams-create-form-error')).toBeDefined()
  })

  it('opens the same dialog from the empty-state shortcut', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope({ teams: [] })))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-empty-cta')).toBeDefined())
    fireEvent.click(screen.getByTestId('teams-empty-cta'))

    await waitFor(() => expect(screen.getByTestId('teams-create-dialog')).toBeDefined())
  })
})

describe('TeamsScreen — joining a team', () => {
  it('joins and refreshes the listing', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope()))
    mockedJoin.mockResolvedValue(jsonResponse(200, { id: 't1', name: 'Blockly Busters' }))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-join-t1')).toBeDefined())
    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope({ myTeamId: 't1' })))
    fireEvent.click(screen.getByTestId('teams-join-t1'))

    await waitFor(() => expect(mockedJoin).toHaveBeenCalledWith({ param: { id: 't1' } }))
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('teams-action-error')).toBeNull()
  })

  // The listing said the team was joinable; someone else took the last slot
  // between the load and the click.
  it('surfaces a 409 that only shows up on the click, and refetches', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, envelope()))
    mockedJoin.mockResolvedValue(jsonResponse(409, { error: 'team_full', message: 'full' }))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-join-t1')).toBeDefined())
    mockedList.mockResolvedValueOnce(
      jsonResponse(
        200,
        envelope({ teams: [team({ slotsAvailable: 0, joinBlockedReason: 'team_full' })] }),
      ),
    )
    fireEvent.click(screen.getByTestId('teams-join-t1'))

    const alert = await screen.findByTestId('teams-action-error')
    expect(alert.textContent).toContain('Esse time ficou cheio antes de você entrar.')
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })

  it('maps a vanished team to its own message', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, envelope()))
    mockedJoin.mockResolvedValue(jsonResponse(404, { error: 'not_found', message: 'gone' }))
    renderTeams()

    await waitFor(() => expect(screen.getByTestId('teams-join-t1')).toBeDefined())
    fireEvent.click(screen.getByTestId('teams-join-t1'))

    const alert = await screen.findByTestId('teams-action-error')
    expect(alert.textContent).toContain('Esse time não existe mais.')
  })
})

describe('TeamsScreen — event rules', () => {
  it.each([false, true])(
    'shows the configured maximum and mixing rule (locked: %s)',
    async (mixingLocked) => {
      mockedList.mockResolvedValue(jsonResponse(200, envelope({ maxTeamSize: 5, mixingLocked })))
      renderTeams()
      const rules = await screen.findByTestId('teams-rules')
      expect(rules.textContent).toContain('5')
      expect(rules.textContent).toContain(mixingLocked ? 'travada' : 'liberada')
    },
  )
})
