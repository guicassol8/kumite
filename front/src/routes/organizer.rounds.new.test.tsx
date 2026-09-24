import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      problems: Object.assign(vi.fn(), { $get: vi.fn() }),
      rounds: Object.assign(vi.fn(), { $get: vi.fn(), $post: vi.fn() }),
    },
  },
}))

// `sse-client.ts` calls `fetch` directly, outside the RPC client — the
// `@/lib/api` mock above never sees it. Reaching `/` mounts `useEventStream`,
// so without this the stream hits a real server (#168).
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedProblemsList = vi.mocked(api.organizer.problems.$get)
const mockedRoundsList = vi.mocked(api.organizer.rounds.$get)
const mockedCreate = vi.mocked(api.organizer.rounds.$post)

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
  visibility: 'round',
  testCaseCount: 2,
  translations: [{ locale: 'pt', title: 'Soma' }],
}

const createdRound = {
  id: 'r1',
  name: 'Rodada 1',
  status: 'draft',
  durationMinutes: 30,
  openedAt: null,
  closesAt: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  problems: [],
}

function renderNewRound() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/rounds/new'] }),
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
  mockedCreate.mockReset()
  mockedProblemsList.mockResolvedValue(jsonResponse(200, [publishedProblem]))
  mockedRoundsList.mockResolvedValue(jsonResponse(200, []))
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('NewRoundScreen', () => {
  it('creates the round in a single call and navigates to the list', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdRound))
    const router = renderNewRound()

    await waitFor(() => expect(screen.getByTestId('round-form-problem-p1')).toBeDefined())
    fireEvent.change(screen.getByTestId('round-form-name'), { target: { value: 'Rodada 1' } })
    fireEvent.click(screen.getByTestId('round-form-problem-p1-checkbox'))
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizer/rounds'))
    expect(mockedCreate).toHaveBeenCalledWith({
      json: { name: 'Rodada 1', durationMinutes: 30, problemIds: ['p1'] },
    })
  })

  it('maps the 400 invalid_problem_ids error without navigating', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(400, { error: 'invalid_problem_ids' }))
    const router = renderNewRound()

    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())
    fireEvent.change(screen.getByTestId('round-form-name'), { target: { value: 'Rodada 1' } })
    fireEvent.click(screen.getByTestId('round-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('round-form-error').textContent).toContain(
        'Um ou mais problemas selecionados são inválidos.',
      ),
    )
    expect(router.state.location.pathname).toBe('/organizer/rounds/new')
  })

  // #233 — the form routes wear the same H2 as the listings restyled by #223.
  it('renders the screen heading in the display face, upper case', async () => {
    renderNewRound()
    await waitFor(() => expect(screen.getByTestId('round-form')).toBeDefined())

    const heading = document.querySelector('h2')
    expect(heading?.className).toContain('font-display')
    expect(heading?.className).toContain('uppercase')
  })
})
