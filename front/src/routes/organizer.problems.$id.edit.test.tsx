import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      problems: Object.assign(vi.fn(), {
        $get: vi.fn(),
        $post: vi.fn(),
        ':id': {
          $get: vi.fn(),
          $patch: vi.fn(),
          publish: { $post: vi.fn() },
          archive: { $post: vi.fn() },
        },
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

const mockedDetail = vi.mocked(api.organizer.problems[':id'].$get)
const mockedPatch = vi.mocked(api.organizer.problems[':id'].$patch)
const mockedPublish = vi.mocked(api.organizer.problems[':id'].publish.$post)
const mockedList = vi.mocked(api.organizer.problems.$get)
const mockedCreate = vi.mocked(api.organizer.problems.$post)

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

const publishedDetail = {
  id: 'p1',
  points: 20,
  difficulty: 'hard',
  status: 'published',
  testCases: [
    { input: [1, 2], expected: 3, hidden: false },
    { input: [4, 5], expected: 9, hidden: true },
  ],
  translations: [
    { locale: 'pt', title: 'Ordenação', statementMd: 'Ordene a lista.' },
    { locale: 'es', title: 'Ordenamiento', statementMd: 'Ordena la lista.' },
    { locale: 'en', title: 'Sorting', statementMd: 'Sort the list.' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const draftDetail = {
  ...publishedDetail,
  status: 'draft',
  translations: [{ locale: 'pt', title: 'Soma', statementMd: 'Some a e b.' }],
}

// Radix's Tabs trigger switches on mousedown/focus, not on a bare click.
function selectTab(locale: 'pt' | 'es' | 'en') {
  fireEvent.mouseDown(screen.getByTestId(`problem-form-tab-${locale}`))
}

function renderEdit(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/problems/p1/edit'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  mockedDetail.mockReset()
  mockedPatch.mockReset()
  mockedPublish.mockReset()
  mockedList.mockReset()
  mockedCreate.mockReset()
  mockedList.mockResolvedValue(jsonResponse(200, []))
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
  // The focus state is global to the manager — leaving it set would leak
  // into the next test in this file.
  focusManager.setFocused(undefined)
})

describe('EditProblemScreen', () => {
  it('seeds the form from the fetched detail, with the cases as JSON text', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    expect(mockedDetail).toHaveBeenCalledWith({ param: { id: 'p1' } })
    expect((screen.getByTestId('problem-form-title-pt') as HTMLInputElement).value).toBe(
      'Ordenação',
    )
    expect((screen.getByTestId('problem-form-points') as HTMLInputElement).value).toBe('20')
    expect((screen.getByTestId('problem-form-case-0-input') as HTMLInputElement).value).toBe(
      '[1,2]',
    )
    expect((screen.getByTestId('problem-form-case-1-expected') as HTMLInputElement).value).toBe('9')

    selectTab('en')
    expect((screen.getByTestId('problem-form-title-en') as HTMLInputElement).value).toBe('Sorting')
  })

  // Acceptance #4: PATCH never touches `status`, so the problem stays
  // published and the screen stays put with a success alert.
  it('saves a published problem without publishing again and keeps its status', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    mockedPatch.mockResolvedValue(jsonResponse(200, publishedDetail))
    const router = renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.change(screen.getByTestId('problem-form-statement-pt'), {
      target: { value: 'Ordene a lista em ordem crescente.' },
    })
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => expect(screen.getByTestId('problem-form-success')).toBeDefined())
    expect(router.state.location.pathname).toBe('/organizer/problems/p1/edit')
    expect(mockedPublish).not.toHaveBeenCalled()
    expect(mockedPatch).toHaveBeenCalledTimes(1)
    expect(mockedPatch.mock.calls[0]?.[0]).toMatchObject({
      param: { id: 'p1' },
      json: { difficulty: 'hard', points: 20 },
    })
    expect(screen.getByTestId('problem-form-status').textContent).toBe('Publicado')
  })

  it('disables Publicar on an already published problem', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form-publish')).toBeDefined())
    expect((screen.getByTestId('problem-form-publish') as HTMLButtonElement).disabled).toBe(true)
  })

  it('patches then publishes a draft and returns to the list', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, { ...publishedDetail, status: 'draft' }))
    mockedPatch.mockResolvedValue(jsonResponse(200, publishedDetail))
    mockedPublish.mockResolvedValue(jsonResponse(200, publishedDetail))
    const router = renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-publish'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizer/problems'))
    expect(mockedPatch).toHaveBeenCalledTimes(1)
    expect(mockedPublish).toHaveBeenCalledWith({ param: { id: 'p1' } })
  })

  it("shows the API's message when publish is refused for an archived problem", async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, { ...publishedDetail, status: 'draft' }))
    mockedPatch.mockResolvedValue(jsonResponse(200, publishedDetail))
    mockedPublish.mockResolvedValue(
      jsonResponse(409, {
        error: 'archived_problem',
        message: 'Cannot publish an archived problem',
      }),
    )
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-publish'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain(
        'Cannot publish an archived problem',
      ),
    )
  })

  it('explains the 409 of a problem in an open round instead of the generic failure', async () => {
    // #193: the API refuses the edit because the round's scores would stop
    // being comparable. The banner has to say that — "Tente novamente" would
    // be a lie, since retrying is exactly what does not work.
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    mockedPatch.mockResolvedValue(
      jsonResponse(409, {
        error: 'problem_in_open_round',
        message: 'Cannot change testCases while the problem is in an open round',
      }),
    )
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => {
      const banner = screen.getByTestId('problem-form-error').textContent ?? ''
      expect(banner).toContain('rodada aberta')
      expect(banner).not.toContain('Tente novamente')
    })
  })

  it('keeps the generic failure for a refusal that is not the open-round 409', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    mockedPatch.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain('Tente novamente'),
    )
  })

  it('keeps an archived problem editable while Publicar stays disabled', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, { ...publishedDetail, status: 'archived' }))
    mockedPatch.mockResolvedValue(jsonResponse(200, publishedDetail))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    expect((screen.getByTestId('problem-form-publish') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByTestId('problem-form-save'))
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1))
  })

  it('refuses to clear a translation the API already stores', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    selectTab('en')
    fireEvent.change(screen.getByTestId('problem-form-title-en'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('problem-form-statement-en'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('problem-form-save'))

    expect(screen.getByTestId('problem-form-title-en-error').textContent).toContain(
      'Não é possível apagar uma tradução já salva',
    )
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  it('shows a not-found state with a way back to the list', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(404, { error: 'not_found', message: 'nope' }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form-not-found')).toBeDefined())
    expect(screen.queryByTestId('problem-form')).toBeNull()
  })

  it('shows the same not-found state for a malformed problem id (#94)', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(422, { error: 'validation_failed', issues: {} }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form-not-found')).toBeDefined())
    expect(screen.queryByTestId('problem-form')).toBeNull()
  })

  it('shows a recoverable error and refetches on retry', async () => {
    mockedDetail.mockResolvedValueOnce(jsonResponse(500, {}))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form-load-error')).toBeDefined())

    mockedDetail.mockResolvedValueOnce(jsonResponse(200, draftDetail))
    fireEvent.click(screen.getByTestId('problem-form-load-retry'))

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    expect(mockedDetail).toHaveBeenCalledTimes(2)
  })

  it('shows the form-level error when the save fails', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftDetail))
    mockedPatch.mockResolvedValue(jsonResponse(404, { error: 'not_found', message: 'nope' }))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain(
        'Não foi possível salvar o problema',
      ),
    )
    expect(screen.queryByTestId('problem-form-success')).toBeNull()
  })

  // #187: the PATCH's body used to be discarded, so a per-field 422 arrived as
  // the same "try again" as a 500.
  it('puts a 422 on points under the field, naming the ceiling', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftDetail))
    mockedPatch.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: {
          body: [
            {
              path: 'points',
              code: 'too_big',
              message: 'Number must be less than or equal to 10000',
            },
          ],
        },
      }),
    )
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-points-error').textContent).toContain('10000'),
    )
    expect(screen.queryByTestId('problem-form-error')).toBeNull()
    expect(screen.queryByTestId('problem-form-success')).toBeNull()
  })

  it('keeps the generic alert for a 500, which carries no issues', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftDetail))
    mockedPatch.mockResolvedValue(jsonResponse(500, {}))
    renderEdit()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain(
        'Não foi possível salvar o problema',
      ),
    )
    expect(screen.queryByTestId('problem-form-points-error')).toBeNull()
  })

  // The screen must not throw away what the organizer is typing: alt-tabbing
  // out and back used to refetch in the background and re-seed the form.
  it('keeps the unsaved statement when the window regains focus', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, draftDetail))
    // The production QueryClient, with none of the test-only defaults: this
    // bug only shows up under `staleTime: 0` + `refetchOnWindowFocus: true`.
    renderEdit(new QueryClient())

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    const typed = 'Um enunciado longo que o organizador acabou de escrever.'
    fireEvent.change(screen.getByTestId('problem-form-statement-pt'), { target: { value: typed } })

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    // Long enough for a focus refetch to resolve and remount the form.
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect((screen.getByTestId('problem-form-statement-pt') as HTMLTextAreaElement).value).toBe(
      typed,
    )
    expect(mockedDetail).toHaveBeenCalledTimes(1)
  })

  it('re-seeds the form when the route moves to another problem', async () => {
    const otherDetail = {
      ...draftDetail,
      id: 'p2',
      points: 55,
      translations: [{ locale: 'pt', title: 'Fatorial', statementMd: 'Calcule n!.' }],
    }
    mockedDetail.mockImplementation(async ({ param }: { param: { id: string } }) =>
      jsonResponse(200, param.id === 'p2' ? otherDetail : draftDetail),
    )
    const router = renderEdit()

    await waitFor(() =>
      expect((screen.getByTestId('problem-form-title-pt') as HTMLInputElement).value).toBe('Soma'),
    )

    await router.navigate({ to: '/organizer/problems/$id/edit', params: { id: 'p2' } })

    await waitFor(() =>
      expect((screen.getByTestId('problem-form-title-pt') as HTMLInputElement).value).toBe(
        'Fatorial',
      ),
    )
    expect((screen.getByTestId('problem-form-points') as HTMLInputElement).value).toBe('55')
  })

  // #233 — the form routes wear the same H2 as the listings restyled by #223.
  it('renders the screen heading in the display face, upper case', async () => {
    mockedDetail.mockResolvedValue(jsonResponse(200, publishedDetail))
    renderEdit()
    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())

    const heading = document.querySelector('h2')
    expect(heading?.className).toContain('font-display')
    expect(heading?.className).toContain('uppercase')
  })
})
