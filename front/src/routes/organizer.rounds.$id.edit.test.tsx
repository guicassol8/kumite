import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      problems: Object.assign(vi.fn(), { $get: vi.fn() }),
      rounds: Object.assign(vi.fn(), {
        $get: vi.fn(),
        ':id': { $get: vi.fn(), $patch: vi.fn() },
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

const mockedProblemsList = vi.mocked(api.organizer.problems.$get)
const mockedRoundsList = vi.mocked(api.organizer.rounds.$get)
const mockedDetail = vi.mocked(api.organizer.rounds[':id'].$get)
const mockedPatch = vi.mocked(api.organizer.rounds[':id'].$patch)

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

const publishedProblem = {
  id: 'p1',
  points: 10,
  difficulty: 'easy',
  status: 'published',
  testCaseCount: 2,
  translations: [{ locale: 'pt', title: 'Soma' }],
}

const draftRound = {
  id: 'r1',
  name: 'Rodada 1',
  status: 'draft',
  durationMinutes: 30,
  openedAt: null,
  closesAt: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  problems: [{ problemId: 'p1', position: 0 }],
}

function renderEdit() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/rounds/r1/edit'] }),
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
  mockedProblemsList.mockReset()
  mockedRoundsList.mockReset()
  mockedDetail.mockReset()
  mockedPatch.mockReset()
  mockedProblemsList.mockResolvedValue(jsonResponse(200, [publishedProblem]))
  mockedRoundsList.mockResolvedValue(jsonResponse(200, []))
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('EditRoundScreen', () => {
  it('loads the draft round and seeds the form', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftRound))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())
    expect(mockedDetail).toHaveBeenCalledWith({ param: { id: 'r1' } })
    expect((screen.getByTestId('round-form-name') as HTMLInputElement).value).toBe('Rodada 1')
  })

  it('shows a not-found state with a way back to the list', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(404, { error: 'not_found' }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('round-form-not-found')).toBeDefined())
    expect(screen.queryByTestId('round-form')).toBeNull()
  })

  it('shows the same not-found state for a malformed round id (#94)', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(422, { error: 'validation_failed' }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('round-form-not-found')).toBeDefined())
    expect(screen.queryByTestId('round-form')).toBeNull()
  })

  it('blocks editing with an explanation when the round is no longer a draft', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, { ...draftRound, status: 'open' }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('round-form-not-draft')).toBeDefined())
    expect(screen.queryByTestId('round-form')).toBeNull()
  })

  it('patches the round and shows a saved message', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftRound))
    mockedPatch.mockResolvedValue(jsonResponse(200, draftRound))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())
    fireEvent.change(screen.getByTestId('round-form-name'), { target: { value: 'Rodada 1 nova' } })
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() => expect(screen.getByTestId('round-form-success')).toBeDefined())
    expect(mockedPatch).toHaveBeenCalledWith({
      param: { id: 'r1' },
      json: { name: 'Rodada 1 nova', durationMinutes: 30, problemIds: ['p1'] },
    })
  })

  // #233 — the form routes wear the same H2 as the listings restyled by #223.
  it('renders the screen heading in the display face, upper case', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftRound))
    renderEdit()
    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())

    const heading = document.querySelector('h2')
    expect(heading?.className).toContain('font-display')
    expect(heading?.className).toContain('uppercase')
  })
})
