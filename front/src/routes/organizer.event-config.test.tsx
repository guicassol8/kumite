import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      'event-config': Object.assign(vi.fn(), { $get: vi.fn(), $patch: vi.fn() }),
      'event-codes': Object.assign(vi.fn(), {
        $get: vi.fn(),
        ':university': { $patch: vi.fn() },
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

const mockedConfigGet = vi.mocked(api.organizer['event-config'].$get)
const mockedConfigPatch = vi.mocked(api.organizer['event-config'].$patch)
const mockedCodesGet = vi.mocked(api.organizer['event-codes'].$get)
const mockedCodePatch = vi.mocked(api.organizer['event-codes'][':university'].$patch)

const organizerUser: SessionUser = {
  id: 'u1',
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

function eventConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    mixingLocked: false,
    maxTeamSize: 3,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function eventCode(overrides: Record<string, unknown> = {}) {
  return {
    code: 'PUCRS2026',
    university: 'pucrs',
    allowedEmailSuffixes: ['edu.pucrs.br'],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderScreen() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/event-config'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedConfigGet.mockReset()
  mockedConfigPatch.mockReset()
  mockedCodesGet.mockReset()
  mockedCodePatch.mockReset()
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('OrganizerEventConfigScreen', () => {
  it('renders team rules and event codes from the two GET responses', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(
      jsonResponse(200, [
        eventCode(),
        eventCode({
          university: 'merida',
          code: 'MERIDA2026',
          allowedEmailSuffixes: ['merida.edu.mx'],
        }),
      ]),
    )
    renderScreen()

    await waitFor(() =>
      expect(
        (screen.getByTestId('event-config-max-team-size-input') as HTMLInputElement).value,
      ).toBe('3'),
    )
    expect(screen.getByTestId('event-config-mixing-switch').getAttribute('aria-checked')).toBe(
      'false',
    )
    await waitFor(() => expect(screen.getByTestId('event-config-codes-table')).toBeDefined())
    expect(screen.getByTestId('event-config-codes-row-pucrs').textContent).toContain('PUCRS2026')
    expect(screen.getByTestId('event-config-codes-row-merida').textContent).toContain('MERIDA2026')
  })

  it('saves a new max team size and shows the saved confirmation', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedConfigPatch.mockResolvedValue(jsonResponse(200, eventConfig({ maxTeamSize: 5 })))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-input')).toBeDefined(),
    )
    fireEvent.change(screen.getByTestId('event-config-max-team-size-input'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('event-config-max-team-size-save'))

    await waitFor(() =>
      expect(mockedConfigPatch).toHaveBeenCalledWith({ json: { maxTeamSize: 5 } }),
    )
    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-saved')).toBeDefined(),
    )
  })

  it('maps a maxTeamSize validation error from the API onto the field', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedConfigPatch.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        message: 'Request input validation failed',
        issues: {
          body: [{ path: 'maxTeamSize', message: 'Máximo permitido é 50.', code: 'too_big' }],
        },
      }),
    )
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-input')).toBeDefined(),
    )
    fireEvent.change(screen.getByTestId('event-config-max-team-size-input'), {
      target: { value: '999' },
    })
    fireEvent.click(screen.getByTestId('event-config-max-team-size-save'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-error').textContent).toBe(
        'Máximo permitido é 50.',
      ),
    )
  })

  it('confirms flipping the mixing lock and persists the new value', async () => {
    mockedConfigGet.mockResolvedValueOnce(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedConfigPatch.mockResolvedValue(jsonResponse(200, eventConfig({ mixingLocked: true })))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-mixing-switch')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-mixing-switch'))

    await waitFor(() => expect(screen.getByTestId('event-config-mixing-confirm')).toBeDefined())
    mockedConfigGet.mockResolvedValueOnce(jsonResponse(200, eventConfig({ mixingLocked: true })))
    fireEvent.click(screen.getByTestId('event-config-mixing-confirm-confirm'))

    await waitFor(() =>
      expect(mockedConfigPatch).toHaveBeenCalledWith({ json: { mixingLocked: true } }),
    )
    await waitFor(() =>
      expect(screen.getByTestId('event-config-mixing-switch').getAttribute('aria-checked')).toBe(
        'true',
      ),
    )
  })

  it('leaves the mixing lock untouched when the confirmation is cancelled', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-mixing-switch')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-mixing-switch'))

    await waitFor(() => expect(screen.getByTestId('event-config-mixing-confirm')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-mixing-confirm-cancel'))

    expect(mockedConfigPatch).not.toHaveBeenCalled()
    expect(screen.getByTestId('event-config-mixing-switch').getAttribute('aria-checked')).toBe(
      'false',
    )
  })

  it('edits an event code and reflects the saved value', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValueOnce(jsonResponse(200, [eventCode()]))
    mockedCodePatch.mockResolvedValue(
      jsonResponse(200, eventCode({ code: 'PUCRS2027', allowedEmailSuffixes: ['edu.pucrs.br'] })),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-pucrs')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-pucrs'))

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-dialog')).toBeDefined())
    fireEvent.change(screen.getByTestId('event-config-codes-edit-code'), {
      target: { value: 'PUCRS2027' },
    })
    mockedCodesGet.mockResolvedValueOnce(jsonResponse(200, [eventCode({ code: 'PUCRS2027' })]))
    fireEvent.click(screen.getByTestId('event-config-codes-edit-save'))

    await waitFor(() =>
      expect(mockedCodePatch).toHaveBeenCalledWith({
        param: { university: 'pucrs' },
        json: { code: 'PUCRS2027', allowedEmailSuffixes: ['edu.pucrs.br'], active: true },
      }),
    )
    await waitFor(() => expect(screen.queryByTestId('event-config-codes-edit-dialog')).toBeNull())
    await waitFor(() =>
      expect(screen.getByTestId('event-config-codes-row-pucrs').textContent).toContain('PUCRS2027'),
    )
  })

  it('shows a code_taken conflict on the code field', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedCodePatch.mockResolvedValue(
      jsonResponse(409, { error: 'code_taken', message: 'This code is already in use' }),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-pucrs')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-pucrs'))

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-dialog')).toBeDefined())
    fireEvent.change(screen.getByTestId('event-config-codes-edit-code'), {
      target: { value: 'MERIDA2026' },
    })
    fireEvent.click(screen.getByTestId('event-config-codes-edit-save'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-codes-edit-code-error').textContent).toBe(
        'Esse código já está em uso.',
      ),
    )
    expect(screen.getByTestId('event-config-codes-edit-dialog')).toBeDefined()
  })

  it('maps an undeclared validation_failed issue onto the active field', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedCodePatch.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        message: 'Request input validation failed',
        issues: { body: [{ path: 'active', message: 'Valor inválido.', code: 'invalid_type' }] },
      }),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-pucrs')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-pucrs'))

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-dialog')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-save'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-codes-edit-active-error').textContent).toBe(
        'Valor inválido.',
      ),
    )
  })
})
