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

// Rendered authenticated, so the real `__root` (#217) always opens the
// shared round SSE stream.
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
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

const archivedProblem = {
  id: 'p4',
  points: 15,
  difficulty: 'medium',
  status: 'archived',
  testCaseCount: 3,
  translations: [{ locale: 'pt', title: 'Fila' }],
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

  // Identity § 5, verifiable through `data-variant` rather than through a
  // colour a jsdom test cannot see. The paint itself is asserted in the
  // browser (e2e/organizer-identity.spec.ts).
  it('paints the difficulty trio with the outlined identity badges', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(200, [draftProblem, untitledProblem, publishedProblem]),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())
    expect(screen.getByTestId('organizer-problems-difficulty-p1').dataset.variant).toBe('success')
    expect(screen.getByTestId('organizer-problems-difficulty-p3').dataset.variant).toBe('warning')
    expect(screen.getByTestId('organizer-problems-difficulty-p2').dataset.variant).toBe(
      'destructive',
    )
  })

  it('paints the state badges and strikes the archived one through', async () => {
    mockedList.mockResolvedValue(
      jsonResponse(200, [draftProblem, publishedProblem, archivedProblem]),
    )
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())
    expect(screen.getByTestId('organizer-problems-status-p2').dataset.variant).toBe('default')
    expect(screen.getByTestId('organizer-problems-status-p1').dataset.variant).toBe('secondary')

    const archived = screen.getByTestId('organizer-problems-status-p4')
    expect(archived.dataset.variant).toBe('secondary')
    // Struck through, so "arquivado" does not rest on colour alone (§ 3).
    expect(archived.className).toContain('line-through')
  })

  it('keeps every row action and its testid, archived rows included', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [draftProblem, archivedProblem]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())
    expect(screen.getByTestId('organizer-problems-edit-p1')).toBeDefined()
    expect(screen.getByTestId('organizer-problems-archive-p1')).toBeDefined()
    // An archived problem can still be edited but not archived again.
    expect(screen.getByTestId('organizer-problems-edit-p4')).toBeDefined()
    expect(screen.queryByTestId('organizer-problems-archive-p4')).toBeNull()
  })

  it('repeats every column header inside the row as its card label', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [draftProblem]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())

    // Below 768px the row is a card and each cell carries its own label; the
    // labels come from the column headers, so no new catalog key is needed.
    const row = screen.getByTestId('organizer-problems-row-p1')
    for (const label of ['Título', 'Dificuldade', 'Pontos', 'Estado', 'Casos', 'Ações']) {
      expect(row.textContent).toContain(label)
    }

    const table = screen.getByTestId('organizer-problems-table')
    const header = table.querySelector('th')
    expect(header?.className).toContain('font-display')
    expect(header?.className).toContain('uppercase')
  })

  it('never puts the table inside a horizontally scrolling wrapper', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [draftProblem]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-table')).toBeDefined())

    // `ui/table.tsx` would have wrapped it in `overflow-x-auto`, which § 5
    // forbids as the answer to overflow.
    let node: HTMLElement | null = screen.getByTestId('organizer-problems-table')
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

// #233 — the archive overlay.
describe('organizer problems — archive dialog in the panel identity (#233)', () => {
  it('titles the dialog as an H2 and puts the archive action in crimson outline', async () => {
    mockedList.mockResolvedValue(jsonResponse(200, [draftProblem]))
    renderList()

    await waitFor(() => expect(screen.getByTestId('organizer-problems-archive-p1')).toBeDefined())
    fireEvent.click(screen.getByTestId('organizer-problems-archive-p1'))

    await waitFor(() =>
      expect(screen.getByTestId('organizer-problems-archive-confirm')).toBeDefined(),
    )
    expectCrimsonOutline(screen.getByTestId('organizer-problems-archive-confirm'))

    const title = document.querySelector('[data-slot="alert-dialog-title"]')
    expect(title?.className).toContain('font-display')
    // § 5: hairlines, no shadow beyond the focus ring.
    const content = document.querySelector('[data-slot="alert-dialog-content"]')
    expect(classesOf(content as Element)).not.toContain('shadow-lg')
  })
})
