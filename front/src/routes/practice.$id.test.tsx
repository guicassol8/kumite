import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    problems: {
      ':id': { $get: vi.fn() },
    },
    rounds: {
      ':id': { $get: vi.fn() },
    },
    submissions: { $post: vi.fn() },
    teams: { $get: vi.fn() },
  },
}))

vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { ROOT_BLOCK_TYPE, type WorkspaceState } from '@kumite/blocks'
import * as Blockly from 'blockly'
import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { saveWorkspaceState } from '@/lib/workspace-storage'
import { routeTree } from '@/routeTree.gen'

const mockedGet = vi.mocked(api.problems[':id'].$get)
const mockedRound = vi.mocked(api.rounds[':id'].$get)
const mockedTeams = vi.mocked(api.teams.$get)

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

/** `GET /problems/:id` for a practice problem, as the back serves it (#209). */
function practiceProblem(overrides: Record<string, unknown> = {}) {
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
    visibility: 'practice',
    roundId: null,
    roundStatus: 'none',
    bestSubmission: null,
    ...overrides,
  }
}

function savedWorkspace(blockId: string): WorkspaceState {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: ROOT_BLOCK_TYPE, id: 'kumiteSolveRoot', x: 40, y: 40 },
        { type: 'math_number', id: blockId, x: 20, y: 20, fields: { NUM: 42 } },
      ],
    },
  }
}

function liveBlockIds(): string[] {
  const workspace = Blockly.getMainWorkspace()
  if (!workspace) throw new Error('the workspace was not injected')
  const state = Blockly.serialization.workspaces.save(workspace) as {
    blocks?: { blocks?: { id?: string }[] }
  }
  return (state.blocks?.blocks ?? []).map((block) => block.id ?? '')
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router }
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedRound.mockReset()
  mockedTeams.mockReset()
  mockedTeams.mockResolvedValue(jsonResponse(200, { myTeamId: 't1', teams: [] }))
  setSession(fakeUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
  localStorage.clear()
})

describe('/practice/$id (#211)', () => {
  it('shows the statement, the examples, the editor and Executar', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, practiceProblem()))

    renderAt('/practice/p1')

    expect(await screen.findByTestId('problem-statement-body')).toBeTruthy()
    expect(screen.getByTestId('problem-example-0')).toBeTruthy()
    expect(screen.getByTestId('problem-example-1')).toBeTruthy()
    expect(await screen.findByTestId('blockly-workspace')).toBeTruthy()
    expect(screen.getByTestId('problem-run-button')).toBeTruthy()
    expect(screen.getByTestId('problem-difficulty-badge')).toBeTruthy()
  })

  it('shows nothing that belongs to a round', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, practiceProblem()))

    renderAt('/practice/p1')
    await screen.findByTestId('problem-run-button')

    for (const testId of [
      'problem-submit-button',
      'problem-points-badge',
      'problem-best-score-badge',
      'problem-no-submission-badge',
      'problem-position-badge',
      'problem-closed-notice',
      'problem-submissions-paused-banner',
    ]) {
      expect(screen.queryByTestId(testId), testId).toBeNull()
    }
    // No team decoration in practice: the team query is never even made.
    expect(mockedTeams).not.toHaveBeenCalled()
    expect(mockedRound).not.toHaveBeenCalled()
  })

  it('reopens the workspace saved for that problem', async () => {
    saveWorkspaceState(fakeUser.id, 'p1', savedWorkspace('blocoDaPratica'))
    mockedGet.mockResolvedValue(jsonResponse(200, practiceProblem()))

    renderAt('/practice/p1')
    await screen.findByTestId('blockly-workspace')

    await waitFor(() => expect(liveBlockIds()).toEqual(expect.arrayContaining(['blocoDaPratica'])))
  })

  it('sends a round problem to /problem/$id', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(
        200,
        practiceProblem({ visibility: 'round', roundId: 'r1', roundStatus: 'open' }),
      ),
    )
    mockedRound.mockResolvedValue(
      jsonResponse(200, {
        id: 'r1',
        name: 'Rodada 1',
        status: 'open',
        closesAt: null,
        closedAt: null,
        problems: [],
      }),
    )

    const { router } = renderAt('/practice/p1')

    await waitFor(() => expect(router.state.location.pathname).toBe('/problem/p1'))
    expect(await screen.findByTestId('problem-submit-button')).toBeTruthy()
  })

  it('sends an anonymous visitor to the login', async () => {
    clearSession('manual')

    const { router } = renderAt('/practice/p1')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
