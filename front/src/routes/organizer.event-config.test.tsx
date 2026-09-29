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
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
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
    submissionsPaused: false,
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
          body: [
            {
              path: 'maxTeamSize',
              message: 'Number must be less than or equal to 10',
              code: 'too_big',
            },
          ],
        },
      }),
    )
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-input')).toBeDefined(),
    )
    // Legal on the client, refused by the API: the value has to get past the
    // form's own ceiling for this to exercise the 422 path at all.
    fireEvent.change(screen.getByTestId('event-config-max-team-size-input'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('event-config-max-team-size-save'))

    // The catalog string, not the envelope's. This assertion used to read
    // 'Máximo permitido é 50.' — a Portuguese `message` kata never emits (its
    // issues carry zod's English) with a `too_big` the back could not yet
    // produce, and it passed only because the screen rendered `issue.message`
    // verbatim. Showing the localized string is the fix, not a weaker check.
    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-error').textContent).toBe(
        'O tamanho máximo do time precisa ser no máximo 10.',
      ),
    )
    // The message above is byte-identical to the one the *client* ceiling
    // produces, so without this the test would still pass if the request never
    // left the browser — and it would have stopped covering the 422 path it
    // exists for. Asserting the call is what keeps the two paths apart.
    expect(mockedConfigPatch).toHaveBeenCalled()
  })

  it('refuses a maxTeamSize over the ceiling without calling the API at all', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-input')).toBeDefined(),
    )
    fireEvent.change(screen.getByTestId('event-config-max-team-size-input'), {
      target: { value: '999999999999' },
    })
    fireEvent.click(screen.getByTestId('event-config-max-team-size-save'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-error').textContent).toBe(
        'O tamanho máximo do time precisa ser no máximo 10.',
      ),
    )
    expect(mockedConfigPatch).not.toHaveBeenCalled()
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

  // #285: no confirmation dialog on purpose — the pause is reversible with
  // the same click, unlike the mixing lock above.
  it('reflects the submissions pause from the GET and toggles it with one PATCH', async () => {
    mockedConfigGet.mockResolvedValueOnce(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedConfigPatch.mockResolvedValue(jsonResponse(200, eventConfig({ submissionsPaused: true })))
    renderScreen()

    const toggle = await screen.findByTestId('event-config-submissions-paused-switch')
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig({ submissionsPaused: true })))
    fireEvent.click(toggle)

    await waitFor(() =>
      expect(mockedConfigPatch).toHaveBeenCalledWith({ json: { submissionsPaused: true } }),
    )
    expect(screen.queryByTestId('event-config-mixing-confirm')).toBeNull()
    await waitFor(() =>
      expect(
        screen.getByTestId('event-config-submissions-paused-switch').getAttribute('aria-checked'),
      ).toBe('true'),
    )
    expect(screen.queryByTestId('event-config-submissions-paused-error')).toBeNull()
  })

  it('shows an error when the pause toggle fails to save', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig({ submissionsPaused: true })))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    mockedConfigPatch.mockResolvedValue(jsonResponse(500, { error: 'internal' }))
    renderScreen()

    const toggle = await screen.findByTestId('event-config-submissions-paused-switch')
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(toggle)

    await waitFor(() =>
      expect(mockedConfigPatch).toHaveBeenCalledWith({ json: { submissionsPaused: false } }),
    )
    expect(
      (await screen.findByTestId('event-config-submissions-paused-error')).textContent,
    ).toContain('Não foi possível salvar')
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
        issues: {
          body: [
            { path: 'active', message: 'Expected boolean, received string', code: 'invalid_type' },
          ],
        },
      }),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-pucrs')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-pucrs'))

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-dialog')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-save'))

    // Same correction as the maxTeamSize case above: the fixture's Portuguese
    // `message` was never something kata emits, and rendering it verbatim was
    // an i18n hole — a pt/es organizer would have been shown zod's English.
    await waitFor(() =>
      expect(screen.getByTestId('event-config-codes-edit-active-error').textContent).toBe(
        'O servidor recusou este valor. Revise o campo.',
      ),
    )
  })
})

// #223 owns the codes TABLE (a reading surface). The edit dialog, the team
// rules form and the mixing switch are #233's and are untouched here.
describe('organizer event config — identity (#223)', () => {
  beforeEach(() => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(
      jsonResponse(200, [
        eventCode(),
        eventCode({
          university: 'merida',
          code: 'MERIDA2026',
          allowedEmailSuffixes: ['merida.edu.mx'],
          active: false,
        }),
      ]),
    )
  })

  it('renders the codes listing as the panel table, never inside a scrolling wrapper', async () => {
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-table')).toBeDefined())
    const table = screen.getByTestId('event-config-codes-table')
    expect(table.className).toContain('table-fixed')
    expect(table.querySelector('th')?.className).toContain('font-display')
    expect(table.querySelector('th')?.className).toContain('uppercase')

    let node: HTMLElement | null = table
    while (node) {
      expect(node.className).not.toContain('overflow-x')
      node = node.parentElement
    }
  })

  it('badges an active code solid and an inactive one grey, keeping the edit trigger', async () => {
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-table')).toBeDefined())
    expect(screen.getByTestId('event-config-codes-active-pucrs').dataset.variant).toBe('default')
    expect(screen.getByTestId('event-config-codes-active-merida').dataset.variant).toBe('secondary')
    // The row trigger stays in #223; what it opens belongs to #233.
    expect(screen.getByTestId('event-config-codes-edit-pucrs')).toBeDefined()
  })
})

/** The element's classes as tokens — a substring match on the whole string
 * hits things like `aria-invalid:border-destructive` by accident. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

function labelFor(testid: string): Element {
  const field = screen.getByTestId(testid)
  const id = field.getAttribute('id')
  const label = id ? document.querySelector(`label[for="${id}"]`) : null
  if (!label) throw new Error(`no label bound to ${testid}`)
  return label
}

// #233 — the event-rule write surfaces. The codes table and the cards stay
// with #223 and are asserted on above, untouched.
describe('organizer event config — write surfaces in the panel identity (#233)', () => {
  beforeEach(() => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
  })

  it('renders the mixing and max-team-size labels at 13/500', async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByTestId('event-config-mixing-switch')).toBeDefined())

    for (const testid of ['event-config-mixing-switch', 'event-config-max-team-size-input']) {
      const classes = classesOf(labelFor(testid))
      expect(classes).toContain('text-[13px]')
      expect(classes).toContain('font-medium')
    }
  })

  it('paints a rejected max team size in 13 px crimson, outline only', async () => {
    renderScreen()
    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-input')).toBeDefined(),
    )

    fireEvent.change(screen.getByTestId('event-config-max-team-size-input'), {
      target: { value: '999999999999' },
    })
    fireEvent.click(screen.getByTestId('event-config-max-team-size-save'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-max-team-size-error').textContent).toBeTruthy(),
    )
    const message = screen.getByTestId('event-config-max-team-size-error')
    expect(classesOf(message)).toContain('text-[13px]')
    expect(classesOf(message)).toContain('text-destructive')
    expect(classesOf(message)).not.toContain('bg-destructive')
    expect(
      screen.getByTestId('event-config-max-team-size-input').getAttribute('aria-invalid'),
    ).toBe('true')
  })
})

// #233 — the two event-config overlays.
describe('organizer event config — overlays in the panel identity (#233)', () => {
  it('puts the mixing LOCK in crimson outline and leaves UNLOCK in ink', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-mixing-switch')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-mixing-switch'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-mixing-confirm-confirm')).toBeDefined(),
    )
    const locking = screen.getByTestId('event-config-mixing-confirm-confirm')
    expect(classesOf(locking)).toContain('border-destructive')
    expect(classesOf(locking)).toContain('text-destructive')
    expect(classesOf(locking)).not.toContain('bg-destructive')
    expect(document.querySelector('[data-slot="alert-dialog-title"]')?.className).toContain(
      'font-display',
    )

    cleanup()

    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig({ mixingLocked: true })))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-mixing-switch')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-mixing-switch'))

    await waitFor(() =>
      expect(screen.getByTestId('event-config-mixing-confirm-confirm')).toBeDefined(),
    )
    const unlocking = screen.getByTestId('event-config-mixing-confirm-confirm')
    expect(classesOf(unlocking)).toContain('bg-primary')
    expect(classesOf(unlocking)).not.toContain('border-destructive')
  })

  it('dresses the event-code dialog: H2 title, 13/500 labels, mono code and suffixes', async () => {
    mockedConfigGet.mockResolvedValue(jsonResponse(200, eventConfig()))
    mockedCodesGet.mockResolvedValue(jsonResponse(200, [eventCode()]))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-pucrs')).toBeDefined())
    fireEvent.click(screen.getByTestId('event-config-codes-edit-pucrs'))

    await waitFor(() => expect(screen.getByTestId('event-config-codes-edit-dialog')).toBeDefined())
    expect(document.querySelector('[data-slot="dialog-title"]')?.className).toContain(
      'font-display',
    )
    expect(classesOf(labelFor('event-config-codes-edit-code'))).toContain('text-[13px]')
    // § 4 puts event codes in Mono.
    expect(classesOf(screen.getByTestId('event-config-codes-edit-code'))).toContain('font-mono')
    expect(classesOf(screen.getByTestId('event-config-codes-edit-suffixes'))).toContain('font-mono')
    // § 5: no shadow on the overlay.
    expect(classesOf(screen.getByTestId('event-config-codes-edit-dialog'))).not.toContain(
      'shadow-lg',
    )
  })
})
