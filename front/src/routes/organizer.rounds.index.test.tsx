import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      rounds: Object.assign(vi.fn(), {
        $get: vi.fn(),
        ':id': {
          open: { $post: vi.fn() },
          extend: { $post: vi.fn() },
          close: { $post: vi.fn() },
        },
      }),
    },
  },
}))

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedList = vi.mocked(api.organizer.rounds.$get)
const mockedOpen = vi.mocked(api.organizer.rounds[':id'].open.$post)
const mockedExtend = vi.mocked(api.organizer.rounds[':id'].extend.$post)
const mockedClose = vi.mocked(api.organizer.rounds[':id'].close.$post)

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

function roundSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'draft',
    durationMinutes: 30,
    openedAt: null,
    closesAt: null,
    closedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    problemCount: 2,
    ...overrides,
  }
}

function renderList() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/rounds'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

beforeEach(() => {
  mockedList.mockReset()
  mockedOpen.mockReset()
  mockedExtend.mockReset()
  mockedClose.mockReset()
  connectEventStream.mockReset()
  connectEventStream.mockImplementation(() => () => {})
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('OrganizerRoundsList', () => {
  it('shows the empty state with a create shortcut', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, []))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-empty')).toBeDefined())
  })

  it('shows a recoverable error and refetches on retry', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(500, {}))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-error')).toBeDefined())

    mockedList.mockResolvedValueOnce(jsonResponse(200, [roundSummary()]))
    fireEvent.click(screen.getByTestId('organizer-rounds-error-retry'))

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-table')).toBeDefined())
    expect(mockedList).toHaveBeenCalledTimes(2)
  })

  it('opens a draft round on confirm', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, [roundSummary()]))
    mockedOpen.mockResolvedValue(
      jsonResponse(200, { ...roundSummary({ status: 'open' }), problems: [] }),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-r1')).toBeDefined())
    // #129's tabIndex is only for the disabled case (its Tooltip has content
    // to show on focus); an enabled Abrir mustn't gain an extra, silent tab
    // stop on its wrapper span ahead of the button itself.
    expect(screen.getByTestId('organizer-rounds-open-hint-r1').getAttribute('tabIndex')).toBeNull()
    fireEvent.click(screen.getByTestId('organizer-rounds-open-r1'))

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-confirm')).toBeDefined())
    mockedList.mockResolvedValueOnce(jsonResponse(200, [roundSummary({ status: 'open' })]))
    fireEvent.click(screen.getByTestId('organizer-rounds-open-confirm'))

    await waitFor(() => expect(mockedOpen).toHaveBeenCalledWith({ param: { id: 'r1' } }))
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })

  it('disables Abrir on other drafts and shows the tooltip name when a round is already open', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({ id: 'r1', name: 'Rodada aberta', status: 'open' }),
        roundSummary({ id: 'r2', name: 'Rodada rascunho', status: 'draft' }),
      ]),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-r2')).toBeDefined())
    expect((screen.getByTestId('organizer-rounds-open-r2') as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(
      screen.getByTestId('organizer-rounds-open-hint-r2').getAttribute('aria-label'),
    ).toContain('Rodada aberta')
    expect(screen.getByTestId('organizer-rounds-open-hint-r2').getAttribute('tabIndex')).toBe('0')
  })

  it('shows the mapped error when opening fails with another_round_open', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, [roundSummary()]))
    mockedOpen.mockResolvedValue(jsonResponse(409, { error: 'another_round_open' }))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-r1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-rounds-open-r1'))
    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-confirm')).toBeDefined())
    mockedList.mockResolvedValueOnce(jsonResponse(200, [roundSummary()]))
    fireEvent.click(screen.getByTestId('organizer-rounds-open-confirm'))

    await waitFor(() =>
      expect(screen.getByTestId('organizer-rounds-action-error').textContent).toContain(
        'Já existe outra rodada aberta.',
      ),
    )
  })

  it('extends an open round and updates the displayed remaining time', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(200, [roundSummary({ status: 'open', closesAt: '2026-01-01T00:30:00.000Z' })]),
    )
    mockedExtend.mockResolvedValue(
      jsonResponse(200, { ...roundSummary({ status: 'open' }), problems: [] }),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-r1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-rounds-extend-r1'))

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-dialog')).toBeDefined())
    fireEvent.change(screen.getByTestId('organizer-rounds-extend-minutes'), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByTestId('organizer-rounds-extend-confirm'))

    await waitFor(() =>
      expect(mockedExtend).toHaveBeenCalledWith({ param: { id: 'r1' }, json: { minutes: 10 } }),
    )
  })

  it('shows the mapped error when extending fails with round_not_open', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [roundSummary({ status: 'open' })]))
    mockedExtend.mockResolvedValue(jsonResponse(409, { error: 'round_not_open' }))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-r1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-rounds-extend-r1'))
    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-dialog')).toBeDefined())
    fireEvent.change(screen.getByTestId('organizer-rounds-extend-minutes'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByTestId('organizer-rounds-extend-confirm'))

    await waitFor(() =>
      expect(screen.getByTestId('organizer-rounds-action-error').textContent).toContain(
        'Essa rodada não está aberta.',
      ),
    )
  })

  it('closes an open round on confirm and flips the row to closed', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, [roundSummary({ status: 'open' })]))
    mockedClose.mockResolvedValue(
      jsonResponse(200, {
        ...roundSummary({ status: 'closed', closedAt: '2026-01-01T01:00:00.000Z' }),
        problems: [],
      }),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-close-r1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-rounds-close-r1'))

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-close-confirm')).toBeDefined())
    mockedList.mockResolvedValueOnce(
      jsonResponse(200, [roundSummary({ status: 'closed', closedAt: '2026-01-01T01:00:00.000Z' })]),
    )
    fireEvent.click(screen.getByTestId('organizer-rounds-close-confirm'))

    await waitFor(() => expect(mockedClose).toHaveBeenCalledWith({ param: { id: 'r1' } }))
    await waitFor(() => expect(screen.getByTestId('organizer-rounds-closed-at-r1')).toBeDefined())
    expect(screen.queryByTestId('organizer-rounds-extend-r1')).toBeNull()
  })

  it('ticks the countdown for the open row from SSE state', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [roundSummary({ status: 'open' })]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-table')).toBeDefined())
    act(() => {
      emitSse({
        type: 'state.sync',
        submissionsPaused: false,
        round: { id: 'r1', closesAt: new Date('2026-01-01T00:30:00.000Z') },
        serverTime: new Date('2026-01-01T00:00:00.000Z'),
      })
    })

    // Scoped to the table: the header (#217) renders its own `round-countdown`
    // chip whenever a round is open, so the bare testid matches two elements
    // once both are mounted.
    await waitFor(() =>
      expect(
        within(screen.getByTestId('organizer-rounds-table')).getByTestId('round-countdown'),
      ).toBeDefined(),
    )
  })
  // Identity § 5: "Aberta" is an outlined badge with a red dot, "Encerrada"
  // and "Rascunho" are grey. Asserted through `data-variant`, since jsdom
  // paints nothing — the colours themselves are checked in the browser
  // (e2e/organizer-identity.spec.ts).
  it('marks the open round with the dotted outline badge and the others grey', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(200, [
        roundSummary({ id: 'r1', status: 'draft' }),
        roundSummary({ id: 'r2', status: 'open', openedAt: '2026-01-01T10:00:00.000Z' }),
        roundSummary({ id: 'r3', status: 'closed', closedAt: '2026-01-01T11:00:00.000Z' }),
      ]),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-table')).toBeDefined())
    expect(screen.getByTestId('organizer-rounds-status-r2').dataset.variant).toBe('outline')
    expect(screen.getByTestId('organizer-rounds-status-dot-r2')).toBeDefined()
    expect(screen.getByTestId('organizer-rounds-status-r1').dataset.variant).toBe('secondary')
    expect(screen.getByTestId('organizer-rounds-status-r3').dataset.variant).toBe('secondary')
    // The dot is decoration; only the open round has one and the word always
    // carries the meaning (§ 3 forbids colour as the only cue).
    expect(screen.queryByTestId('organizer-rounds-status-dot-r1')).toBeNull()
    expect(screen.queryByTestId('organizer-rounds-status-dot-r3')).toBeNull()
  })

  it('repeats every column header inside the row and keeps the table unscrolled', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [roundSummary()]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-table')).toBeDefined())

    const row = screen.getByTestId('organizer-rounds-row-r1')
    for (const label of ['Nome', 'Estado', 'Duração', 'Problemas', 'Ações']) {
      expect(row.textContent).toContain(label)
    }

    const table = screen.getByTestId('organizer-rounds-table')
    expect(table.querySelector('th')?.className).toContain('font-display')
    let node: HTMLElement | null = table
    while (node) {
      expect(node.className).not.toContain('overflow-x')
      node = node.parentElement
    }
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

// #233 — the three round overlays.
describe('organizer rounds — overlays in the panel identity (#233)', () => {
  it('makes "Abrir rodada" the screen\'s only brand-filled button, and only inside its dialog', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [roundSummary()]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-r1')).toBeDefined())
    // Before the overlay opens the table carries no brand fill at all.
    expect(
      [...document.querySelectorAll('button')].filter((button) =>
        classesOf(button).includes('bg-brand'),
      ),
    ).toHaveLength(0)

    fireEvent.click(screen.getByTestId('organizer-rounds-open-r1'))
    await waitFor(() => expect(screen.getByTestId('organizer-rounds-open-confirm')).toBeDefined())

    const branded = [...document.querySelectorAll('button')].filter((button) =>
      classesOf(button).includes('bg-brand'),
    )
    expect(branded).toHaveLength(1)
    expect(branded[0]?.getAttribute('data-testid')).toBe('organizer-rounds-open-confirm')
    // `bg-brand` being present is not enough: while `AlertDialogAction` passed
    // the class to Radix's Slot, the variant's `bg-primary` stayed next to it
    // and won on stylesheet order, so this very assertion passed with the
    // button rendering in ink. Its absence is what proves the merge happened.
    expect(classesOf(branded[0] as Element)).not.toContain('bg-primary')
    expect(document.querySelector('[data-slot="alert-dialog-title"]')?.className).toContain(
      'font-display',
    )
  })

  it('puts "Encerrar rodada" in crimson outline', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [roundSummary({ status: 'open' })]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-close-r1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-rounds-close-r1'))

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-close-confirm')).toBeDefined())
    expectCrimsonOutline(screen.getByTestId('organizer-rounds-close-confirm'))
  })

  it('dresses the extend dialog and marks an invalid minutes field aria-invalid', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [roundSummary({ status: 'open' })]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-r1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-rounds-extend-r1'))
    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-dialog')).toBeDefined())

    expect(document.querySelector('[data-slot="dialog-title"]')?.className).toContain(
      'font-display',
    )
    const minutes = screen.getByTestId('organizer-rounds-extend-minutes')
    const label = document.querySelector(`label[for="${minutes.getAttribute('id')}"]`)
    expect(classesOf(label as Element)).toContain('text-[13px]')
    expect(classesOf(label as Element)).toContain('font-medium')
    // The description moved into DialogDescription, so Radix gets its
    // aria-describedby instead of a loose paragraph.
    expect(document.querySelector('[data-slot="dialog-description"]')).toBeTruthy()
    // Extending is not destructive: the confirm stays ink.
    expect(classesOf(screen.getByTestId('organizer-rounds-extend-confirm'))).toContain('bg-primary')

    fireEvent.change(minutes, { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('organizer-rounds-extend-confirm'))

    await waitFor(() => expect(screen.getByTestId('organizer-rounds-extend-error')).toBeDefined())
    expect(screen.getByTestId('organizer-rounds-extend-minutes').getAttribute('aria-invalid')).toBe(
      'true',
    )
    const message = screen.getByTestId('organizer-rounds-extend-error')
    expect(classesOf(message)).toContain('text-[13px]')
    expect(classesOf(message)).toContain('text-destructive')
  })
})
