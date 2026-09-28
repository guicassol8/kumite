import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

const mockedCreate = vi.mocked(api.organizer.problems.$post)
const mockedPatch = vi.mocked(api.organizer.problems[':id'].$patch)
const mockedPublish = vi.mocked(api.organizer.problems[':id'].publish.$post)
const mockedDetail = vi.mocked(api.organizer.problems[':id'].$get)
const mockedList = vi.mocked(api.organizer.problems.$get)

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

const createdDetail = {
  id: 'p9',
  points: 100,
  difficulty: 'easy',
  status: 'draft',
  visibility: 'round',
  testCases: [],
  translations: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderNewProblem() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer/problems/new'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// Radix's Tabs trigger switches on mousedown/focus, not on a bare click.
function selectTab(locale: 'pt' | 'es' | 'en') {
  fireEvent.mouseDown(screen.getByTestId(`problem-form-tab-${locale}`))
}

async function fillPtDraft() {
  await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
  fireEvent.change(screen.getByTestId('problem-form-title-pt'), { target: { value: 'Soma' } })
  fireEvent.change(screen.getByTestId('problem-form-statement-pt'), {
    target: { value: 'Some a e b.' },
  })
}

beforeEach(() => {
  mockedCreate.mockReset()
  mockedPatch.mockReset()
  mockedPublish.mockReset()
  mockedDetail.mockReset()
  mockedList.mockReset()
  mockedList.mockResolvedValue(jsonResponse(200, []))
  mockedDetail.mockResolvedValue(jsonResponse(200, createdDetail))
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('NewProblemScreen', () => {
  it('creates then patches the problem and lands on its edit route', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdDetail))
    mockedPatch.mockResolvedValue(jsonResponse(200, createdDetail))
    const router = renderNewProblem()

    await fillPtDraft()
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizer/problems/p9/edit'))
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    // Untouched visibility control → the problem is created as a round one.
    expect(mockedCreate).toHaveBeenCalledWith({
      json: { difficulty: 'easy', points: 100, visibility: 'round' },
    })
    expect(mockedPatch).toHaveBeenCalledTimes(1)
    expect(mockedPatch).toHaveBeenCalledWith({
      param: { id: 'p9' },
      json: {
        difficulty: 'easy',
        points: 100,
        visibility: 'round',
        testCases: [],
        translations: [{ locale: 'pt', title: 'Soma', statementMd: 'Some a e b.' }],
      },
    })
  })

  // The orphan-draft guard: the POST already created the row, so a retry after
  // a failed PATCH must not create a second one.
  it('retries only the PATCH after it fails, never a second POST', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdDetail))
    mockedPatch.mockResolvedValueOnce(jsonResponse(404, { error: 'not_found', message: 'nope' }))
    const router = renderNewProblem()

    await fillPtDraft()
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => expect(screen.getByTestId('problem-form-error')).toBeDefined())
    expect(router.state.location.pathname).toBe('/organizer/problems/new')

    mockedPatch.mockResolvedValueOnce(jsonResponse(200, createdDetail))
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizer/problems/p9/edit'))
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    expect(mockedPatch).toHaveBeenCalledTimes(2)
  })

  it('shows the form-level error when the create itself fails', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(500, {}))
    renderNewProblem()

    await fillPtDraft()
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain(
        'Não foi possível salvar o problema',
      ),
    )
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  // #187: the POST carries difficulty and points, so it is the request that
  // refuses a score over the ceiling — and its body used to be thrown away.
  it('puts the 422 from the create under the points field, not in a generic alert', async () => {
    mockedCreate.mockResolvedValue(
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
    renderNewProblem()

    await fillPtDraft()
    // Past the client-side ceiling the form would refuse this before sending,
    // so the probe sends a legal value and lets the API be the one to say no.
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-points-error').textContent).toContain('10000'),
    )
    expect(screen.queryByTestId('problem-form-error')).toBeNull()
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  it('puts a 422 from the patch under the field it names', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdDetail))
    mockedPatch.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: {
          body: [{ path: 'translations[0].title', code: 'too_small', message: 'Required' }],
        },
      }),
    )
    renderNewProblem()

    await fillPtDraft()
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-title-pt-error').textContent).toBe(
        'O servidor recusou este valor. Revise o campo.',
      ),
    )
    expect(screen.queryByTestId('problem-form-error')).toBeNull()
  })

  it('keeps the generic alert for a 422 whose paths match no field', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdDetail))
    mockedPatch.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        issues: { body: [{ path: 'translations', message: 'Duplicate locale(s)' }] },
      }),
    )
    renderNewProblem()

    await fillPtDraft()
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain(
        'Não foi possível salvar o problema',
      ),
    )
  })

  it('chains create, patch and publish, then goes back to the list', async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdDetail))
    mockedPatch.mockResolvedValue(jsonResponse(200, createdDetail))
    mockedPublish.mockResolvedValue(jsonResponse(200, { ...createdDetail, status: 'published' }))
    const router = renderNewProblem()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    for (const locale of ['pt', 'es', 'en'] as const) {
      selectTab(locale)
      fireEvent.change(screen.getByTestId(`problem-form-title-${locale}`), {
        target: { value: `Título ${locale}` },
      })
      fireEvent.change(screen.getByTestId(`problem-form-statement-${locale}`), {
        target: { value: `Enunciado ${locale}` },
      })
    }
    fireEvent.click(screen.getByTestId('problem-form-add-case'))
    fireEvent.change(screen.getByTestId('problem-form-case-0-input'), {
      target: { value: '[1,2]' },
    })
    fireEvent.change(screen.getByTestId('problem-form-case-0-expected'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('problem-form-add-case'))
    fireEvent.change(screen.getByTestId('problem-form-case-1-input'), {
      target: { value: '[4,5]' },
    })
    fireEvent.change(screen.getByTestId('problem-form-case-1-expected'), { target: { value: '9' } })
    fireEvent.click(screen.getByTestId('problem-form-case-1-hidden'))

    fireEvent.click(screen.getByTestId('problem-form-publish'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizer/problems'))
    expect(mockedCreate).toHaveBeenCalledTimes(1)
    expect(mockedPatch).toHaveBeenCalledTimes(1)
    expect(mockedPublish).toHaveBeenCalledWith({ param: { id: 'p9' } })
  })

  // #347: a practice problem is created as one and publishes on a single
  // visible case — no hidden case asked for.
  it('creates and publishes a practice problem with only a visible case', async () => {
    const practiceDetail = { ...createdDetail, visibility: 'practice' }
    mockedCreate.mockResolvedValue(jsonResponse(201, practiceDetail))
    mockedPatch.mockResolvedValue(jsonResponse(200, practiceDetail))
    mockedPublish.mockResolvedValue(jsonResponse(200, { ...practiceDetail, status: 'published' }))
    const router = renderNewProblem()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    const trigger = screen.getByTestId('problem-form-visibility')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.keyDown(await screen.findByTestId('problem-form-visibility-practice'), {
      key: 'Enter',
    })
    await waitFor(() => expect(screen.getByTestId('problem-form-practice-note')).toBeDefined())

    for (const locale of ['pt', 'es', 'en'] as const) {
      selectTab(locale)
      fireEvent.change(screen.getByTestId(`problem-form-title-${locale}`), {
        target: { value: `Título ${locale}` },
      })
      fireEvent.change(screen.getByTestId(`problem-form-statement-${locale}`), {
        target: { value: `Enunciado ${locale}` },
      })
    }
    fireEvent.click(screen.getByTestId('problem-form-add-case'))
    fireEvent.change(screen.getByTestId('problem-form-case-0-input'), {
      target: { value: '[1,2]' },
    })
    fireEvent.change(screen.getByTestId('problem-form-case-0-expected'), { target: { value: '3' } })

    fireEvent.click(screen.getByTestId('problem-form-publish'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/organizer/problems'))
    expect(mockedCreate).toHaveBeenCalledWith({
      json: { difficulty: 'easy', points: 100, visibility: 'practice' },
    })
    expect(mockedPatch.mock.calls[0]?.[0].json.visibility).toBe('practice')
    expect(mockedPublish).toHaveBeenCalledWith({ param: { id: 'p9' } })
  })

  it("surfaces the API's message when publish is rejected", async () => {
    mockedCreate.mockResolvedValue(jsonResponse(201, createdDetail))
    mockedPatch.mockResolvedValue(jsonResponse(200, createdDetail))
    mockedPublish.mockResolvedValue(
      jsonResponse(400, {
        error: 'incomplete_translations',
        message: 'Missing translations for locale(s): en',
      }),
    )
    const router = renderNewProblem()

    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())
    for (const locale of ['pt', 'es', 'en'] as const) {
      selectTab(locale)
      fireEvent.change(screen.getByTestId(`problem-form-title-${locale}`), {
        target: { value: `Título ${locale}` },
      })
      fireEvent.change(screen.getByTestId(`problem-form-statement-${locale}`), {
        target: { value: `Enunciado ${locale}` },
      })
    }
    fireEvent.click(screen.getByTestId('problem-form-add-case'))
    fireEvent.change(screen.getByTestId('problem-form-case-0-input'), {
      target: { value: '[1,2]' },
    })
    fireEvent.change(screen.getByTestId('problem-form-case-0-expected'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('problem-form-add-case'))
    fireEvent.change(screen.getByTestId('problem-form-case-1-input'), {
      target: { value: '[4,5]' },
    })
    fireEvent.change(screen.getByTestId('problem-form-case-1-expected'), { target: { value: '9' } })
    fireEvent.click(screen.getByTestId('problem-form-case-1-hidden'))

    fireEvent.click(screen.getByTestId('problem-form-publish'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-error').textContent).toContain(
        'Missing translations for locale(s): en',
      ),
    )
    expect(router.state.location.pathname).toBe('/organizer/problems/new')
  })

  // #233 — the form routes wear the same H2 as the listings restyled by #223.
  it('renders the screen heading in the display face, upper case', async () => {
    renderNewProblem()
    await waitFor(() => expect(screen.getByTestId('problem-form')).toBeDefined())

    const heading = document.querySelector('h2')
    expect(heading?.className).toContain('font-display')
    expect(heading?.className).toContain('uppercase')
  })
})
