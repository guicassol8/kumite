import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    problems: {
      ':id': { $get: vi.fn() },
    },
    submissions: { $post: vi.fn() },
  },
}))

vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedGet = vi.mocked(api.problems[':id'].$get)
const mockedSubmit = vi.mocked(api.submissions.$post)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, json: async () => body }
}

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function participantProblem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    points: 10,
    difficulty: 'easy',
    locale: 'pt',
    title: 'Soma dos Pares',
    statementMd: 'Some os pares.',
    examples: [
      { input: [1, 2, 3, 4], expected: 6 },
      { input: [5, 7, 9], expected: 0 },
    ],
    roundId: 'r1',
    roundStatus: 'open',
    bestSubmission: null,
    ...overrides,
  }
}

function renderProblem(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/problem/p1'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedSubmit.mockReset()
  setSession(fakeUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('ProblemScreen', () => {
  it('shows a loading state before the problem resolves', async () => {
    mockedGet.mockReturnValue(new Promise(() => {}))

    renderProblem()

    expect(await screen.findByTestId('problem-loading')).toBeDefined()
  })

  it('renders the not-found state for an unknown problem', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(404, { error: 'not_found', message: 'Problem not found' }),
    )

    renderProblem()

    expect(await screen.findByTestId('problem-not-found')).toBeDefined()
  })

  it('renders the same not-found state for a malformed problem id (#94)', async () => {
    mockedGet.mockResolvedValue(jsonResponse(422, { error: 'validation_failed', issues: {} }))

    renderProblem()

    expect(await screen.findByTestId('problem-not-found')).toBeDefined()
  })

  it('loads the statement and examples on a happy load', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

    renderProblem()

    expect(await screen.findByTestId('problem-statement-panel')).toHaveProperty(
      'textContent',
      expect.stringContaining('Soma dos Pares'),
    )
    expect(screen.getByTestId('problem-example-0')).toBeDefined()
    expect(screen.getByTestId('problem-submit-button')).toBeDefined()
  })

  it('shows a retry banner on a load failure and retries on click', async () => {
    mockedGet
      .mockResolvedValueOnce(jsonResponse(500, { error: 'internal', message: 'boom' }))
      .mockResolvedValueOnce(jsonResponse(200, participantProblem()))

    renderProblem()

    await screen.findByTestId('problem-load-error')
    fireEvent.click(screen.getByTestId('problem-load-retry'))

    expect(await screen.findByTestId('problem-statement-panel')).toBeDefined()
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it('submits the workspace and renders the verdict panel on 201', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(
      jsonResponse(201, {
        submissionId: 's1',
        attemptNumber: 1,
        score: 20,
        maxScore: 20,
        cases: [{ hidden: false, index: 0, outcome: 'passed', expected: 6, actual: 6, ms: 3 }],
      }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')

    fireEvent.click(screen.getByTestId('problem-submit-button'))

    expect(await screen.findByTestId('problem-verdict-panel')).toBeDefined()
    expect(mockedSubmit).toHaveBeenCalledWith({
      json: expect.objectContaining({ problemId: 'p1', roundId: 'r1', locale: 'pt' }),
    })
  })

  it('disables the submit button and shows progress while the submission is in flight', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    // biome-ignore lint/suspicious/noExplicitAny: resolved manually below with a minimal Response stub
    let resolveSubmit: (value: any) => void = () => {}
    mockedSubmit.mockReturnValue(
      // biome-ignore lint/suspicious/noExplicitAny: same reason as jsonResponse's stub
      new Promise<any>((resolve) => {
        resolveSubmit = resolve
      }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))

    await waitFor(() => {
      expect((screen.getByTestId('problem-submit-button') as HTMLButtonElement).disabled).toBe(true)
    })
    expect(screen.getByTestId('problem-submit-button').textContent).toContain('Enviando')

    resolveSubmit(
      jsonResponse(201, {
        submissionId: 's1',
        attemptNumber: 1,
        score: 0,
        maxScore: 20,
        cases: [],
      }),
    )
    await waitFor(() => {
      expect((screen.getByTestId('problem-submit-button') as HTMLButtonElement).disabled).toBe(
        false,
      )
    })
  })

  it('shows a dismissible cooldown banner on 429 without treating it as fatal', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(
      jsonResponse(429, { error: 'submission_throttled', message: 'Wait 5s' }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))

    const banner = await screen.findByTestId('problem-cooldown-banner')
    expect(banner).toBeDefined()
    expect((screen.getByTestId('problem-submit-button') as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByText('Dispensar'))
    expect(screen.queryByTestId('problem-cooldown-banner')).toBeNull()
  })

  it('shows the raw server message on a 400 codegen_rejected response', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(
      jsonResponse(400, { error: 'blocks_error', message: 'Bloco inválido: xyz' }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))

    const banner = await screen.findByTestId('problem-submit-error-banner')
    expect(banner.textContent).toContain('Bloco inválido: xyz')
  })

  it('shows a generic race banner on a 404 during submit', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(
      jsonResponse(404, { error: 'no_active_round', message: 'No active round' }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))

    const banner = await screen.findByTestId('problem-submit-error-banner')
    expect(banner.textContent).toContain('Algo mudou')
  })

  it('shows the generic unexpected-error banner on a 5xx during submit, not the race message', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(jsonResponse(500, { error: 'internal', message: 'boom' }))

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))

    const banner = await screen.findByTestId('problem-submit-error-banner')
    expect(banner.textContent).not.toContain('Algo mudou')
    expect(banner.textContent).toContain('Não foi possível enviar')
  })

  it('shows the closed-round notice with the best score and no submit button', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(
        200,
        participantProblem({
          roundStatus: 'closed',
          roundId: null,
          bestSubmission: { score: 8, achievedAt: '2026-09-02T13:00:00.000Z', attempts: 2 },
        }),
      ),
    )

    renderProblem()

    expect(await screen.findByTestId('problem-closed-notice')).toBeDefined()
    expect(screen.getByTestId('problem-closed-best-score').textContent).toContain('8')
    expect(screen.queryByTestId('problem-submit-button')).toBeNull()
  })

  it('shows the never-submitted message for a closed round with no best submission', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(
        200,
        participantProblem({ roundStatus: 'closed', roundId: null, bestSubmission: null }),
      ),
    )

    renderProblem()

    expect(await screen.findByTestId('problem-closed-never-submitted')).toBeDefined()
    expect(screen.queryByTestId('problem-submit-button')).toBeNull()
  })
})
