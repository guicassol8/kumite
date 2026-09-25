import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    practice: {
      problems: { $get: vi.fn() },
    },
  },
}))

vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedList = vi.mocked(api.practice.problems.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

const fakeUser: SessionUser = {
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

const catalog = [
  { id: 'p-easy', title: 'Soma dos Pares', difficulty: 'easy', locale: 'pt' },
  { id: 'p-medium', title: 'Maior Sequência', difficulty: 'medium', locale: 'pt' },
  { id: 'p-hard', title: 'Palíndromos', difficulty: 'hard', locale: 'pt' },
]

function renderPractice() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/practice'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router }
}

beforeEach(() => {
  mockedList.mockReset()
  setSession(fakeUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('/practice (#211)', () => {
  it('lists every practice problem with its difficulty and a link to open it', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, catalog))

    renderPractice()

    const list = await screen.findByTestId('practice-list')
    expect(mockedList).toHaveBeenCalledWith({ query: { locale: 'pt' } })
    const labels = ['Fácil', 'Médio', 'Difícil']
    for (const [index, problem] of catalog.entries()) {
      const difficulty = labels[index] ?? ''
      const item = within(list).getByTestId(`practice-problem-${problem.id}`)
      expect(item.textContent).toContain(problem.title)
      expect(item.textContent).toContain(difficulty)
      const link = within(item).getByTestId(`practice-problem-link-${problem.id}`)
      expect(link.getAttribute('href')).toBe(`/practice/${problem.id}`)
    }
    expect(screen.queryByTestId('practice-empty')).toBeNull()
  })

  it('keeps the order the back serves', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, catalog))

    renderPractice()

    const list = await screen.findByTestId('practice-list')
    const ids = [...list.querySelectorAll('[data-testid^="practice-problem-p"]')]
      .map((element) => element.getAttribute('data-testid'))
      .filter((testId) => !testId?.startsWith('practice-problem-link-'))
    expect(ids).toEqual([
      'practice-problem-p-easy',
      'practice-problem-p-medium',
      'practice-problem-p-hard',
    ])
  })

  it('shows an explicit empty state when there is nothing to practice', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, []))

    renderPractice()

    expect((await screen.findByTestId('practice-empty')).textContent).not.toBe('')
    expect(screen.queryByTestId('practice-list')).toBeNull()
  })

  it('shows a load error whose retry asks again', async () => {
    mockedList
      .mockResolvedValueOnce(jsonResponse(500, { error: 'internal', message: 'boom' }))
      .mockResolvedValueOnce(jsonResponse(200, catalog))

    renderPractice()

    await screen.findByTestId('practice-load-error')
    fireEvent.click(screen.getByTestId('practice-load-retry'))

    expect(await screen.findByTestId('practice-list')).toBeTruthy()
    expect(mockedList).toHaveBeenCalledTimes(2)
  })

  it('shows a loading state before the list resolves', async () => {
    mockedList.mockReturnValue(new Promise(() => {}))

    renderPractice()

    expect(await screen.findByTestId('practice-loading')).toBeTruthy()
  })

  it('sends an anonymous visitor to the login, remembering where they were going', async () => {
    clearSession('manual')

    const { router } = renderPractice()

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual(
      expect.objectContaining({ redirect: expect.stringContaining('/practice') }),
    )
    expect(mockedList).not.toHaveBeenCalled()
  })
})
