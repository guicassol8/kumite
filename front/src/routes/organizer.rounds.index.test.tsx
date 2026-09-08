import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
        round: { id: 'r1', closesAt: new Date('2026-01-01T00:30:00.000Z') },
        serverTime: new Date('2026-01-01T00:00:00.000Z'),
      })
    })

    await waitFor(() => expect(screen.getByTestId('round-countdown')).toBeDefined())
  })
})
