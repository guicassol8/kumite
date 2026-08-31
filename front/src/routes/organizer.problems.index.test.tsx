import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      problems: Object.assign(vi.fn(), {
        $get: vi.fn(),
        ':id': { archive: { $post: vi.fn() } },
      }),
    },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedList = vi.mocked(api.organizer.problems.$get)
const mockedArchive = vi.mocked(api.organizer.problems[':id'].archive.$post)

const organizerUser: SessionUser = {
  id: 'u1',
  email: 'org@edu.pucrs.br',
  role: 'organizer',
  university: 'pucrs',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const draftProblem = {
  id: 'p1',
  points: 10,
  difficulty: 'easy',
  status: 'draft',
  testCaseCount: 2,
  translations: [{ locale: 'pt', title: 'Soma de dois números' }],
}

const publishedProblem = {
  id: 'p2',
  points: 20,
  difficulty: 'hard',
  status: 'published',
  testCaseCount: 4,
  translations: [
    { locale: 'pt', title: 'Ordenação' },
    { locale: 'es', title: 'Ordenamiento' },
    { locale: 'en', title: 'Sorting' },
  ],
}

const untitledProblem = {
  id: 'p3',
  points: 5,
  difficulty: 'medium',
  status: 'draft',
  testCaseCount: 0,
  translations: [],
}

function renderList(initialEntry = '/organizer/problems') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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
  mockedArchive.mockReset()
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('OrganizerProblemsList', () => {
  it('shows a loading state, then renders the table with resolved titles', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [draftProblem, publishedProblem]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-loading')).toBeDefined())

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())
    expect(screen.getByTestId('organizer-problems-row-p1').textContent).toContain(
      'Soma de dois números',
    )
    expect(screen.getByTestId('organizer-problems-row-p2').textContent).toContain('Ordenação')
  })

  it('shows the placeholder title when a problem has no translations at all', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [untitledProblem]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())
    expect(screen.getByTestId('organizer-problems-row-p3').textContent).toContain('(sem título)')
  })

  it('shows the empty state with a create shortcut when there are no problems', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, []))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-empty')).toBeDefined())
  })

  it('shows a recoverable error and refetches on retry', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(500, { error: 'internal' }))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-error')).toBeDefined())

    mockedList.mockResolvedValueOnce(jsonResponse(200, [draftProblem]))
    fireEvent.click(screen.getByTestId('organizer-problems-error-retry'))

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())
    expect(mockedList).toHaveBeenCalledTimes(2)
  })

  it('archives a problem on confirm and refreshes the list', async () => {
    mockedList.mockResolvedValueOnce(jsonResponse(200, [draftProblem]))
    mockedArchive.mockResolvedValue(jsonResponse(200, { ...draftProblem, status: 'archived' }))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-archive-p1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-problems-archive-p1'))

    await waitFor(() =>
      expect(screen.getByTestId('organizer-problems-archive-confirm')).toBeDefined(),
    )

    mockedList.mockResolvedValueOnce(jsonResponse(200, [{ ...draftProblem, status: 'archived' }]))
    fireEvent.click(screen.getByTestId('organizer-problems-archive-confirm'))

    await waitFor(() => expect(mockedArchive).toHaveBeenCalledWith({ param: { id: 'p1' } }))
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })
})
