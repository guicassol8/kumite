import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    problems: {
      ':id': { $get: vi.fn() },
    },
    // The screen reads the round too since #219 (the problem's A/B/C letter
    // lives on `/rounds/:id`). Left out, every test in this file dies in the
    // jsdom network guard rather than in the assertion it was written for.
    rounds: {
      ':id': { $get: vi.fn() },
    },
    submissions: { $post: vi.fn() },
    // Whether the caller has a team decides the "no submissions" badge (#206).
    teams: { $get: vi.fn() },
  },
}))

vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { ROOT_BLOCK_TYPE, type WorkspaceState } from '@kumite/blocks'
import * as Blockly from 'blockly'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { connectEventStream } from '@/lib/sse-client'
import type { SseEvent } from '@/lib/sse-schema'
import { loadWorkspaceState, saveWorkspaceState } from '@/lib/workspace-storage'
import { routeTree } from '@/routeTree.gen'

const mockedGet = vi.mocked(api.problems[':id'].$get)
const mockedRound = vi.mocked(api.rounds[':id'].$get)
const mockedSubmit = vi.mocked(api.submissions.$post)
const mockedTeams = vi.mocked(api.teams.$get)

function emitSse(event: SseEvent) {
  const onEvent = vi.mocked(connectEventStream).mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

function withTeam() {
  mockedTeams.mockResolvedValue(jsonResponse(200, { myTeamId: 't1', teams: [] }))
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

// A saved workspace holding the undeletable root plus one identifiable block,
// which is what the assertions below count. They never read a block's *label*:
// the labels on this same locale path have bugs of their own (#183, #202) and
// this file must not go red over them.
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

// `WorkspaceState` types its payload loosely, so the block ids this file
// asserts on need a shape of their own.
type SerializedBlock = { id?: string }

function blockIdsOf(state: WorkspaceState | undefined): string[] {
  const serialized = state as { blocks?: { blocks?: SerializedBlock[] } } | undefined
  return (serialized?.blocks?.blocks ?? []).map((block) => block.id ?? '')
}

/** The blocks actually on the canvas right now, read from Blockly itself. */
function liveBlockIds(): string[] {
  const workspace = Blockly.getMainWorkspace()
  if (!workspace) throw new Error('the workspace was not injected')
  return blockIdsOf(Blockly.serialization.workspaces.save(workspace))
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

/** `GET /rounds/:id` as the participant sees it — only what this file reads. */
function participantRound(problems: { problemId: string; position: number }[]) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'open',
    closesAt: null,
    closedAt: null,
    problems: problems.map(({ problemId, position }) => ({
      problemId,
      position,
      title: 'Soma dos Pares',
      difficulty: 'easy',
      points: 10,
      bestScore: null,
    })),
  }
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedRound.mockReset()
  mockedSubmit.mockReset()
  mockedTeams.mockReset()
  mockedTeams.mockResolvedValue(jsonResponse(200, { myTeamId: null, teams: [] }))
  // The default for every test that does not care about the letter: a round
  // that simply has no entry for this problem, so no badge and no unhandled
  // rejection either.
  mockedRound.mockResolvedValue(jsonResponse(200, participantRound([])))
  setSession(fakeUser, 'tok-1')
})

afterEach(async () => {
  cleanup()
  clearSession('manual')
  localStorage.clear()
  // i18n is a singleton: a test that switches the language here would
  // otherwise poison every other file in the run (same reason as
  // language-selector.test.tsx and use-blockly-locale.test.tsx).
  await i18n.changeLanguage('pt')
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

  // #285: the organizer's pause reaches the editor over SSE, no reload.
  it('shows the paused banner and disables only Submeter while submissions are paused', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    expect(screen.queryByTestId('problem-submissions-paused-banner')).toBeNull()

    emitSse({ type: 'state.sync', serverTime: new Date(), round: null, submissionsPaused: true })

    expect(screen.getByTestId('problem-submissions-paused-banner').textContent).toContain(
      'pausadas',
    )
    expect((screen.getByTestId('problem-submit-button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('problem-run-button') as HTMLButtonElement).disabled).toBe(false)

    emitSse({ type: 'submissions.resumed', serverTime: new Date() })

    expect(screen.queryByTestId('problem-submissions-paused-banner')).toBeNull()
    expect((screen.getByTestId('problem-submit-button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('explains the pause when a submit races it and comes back 423', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(
      jsonResponse(423, { error: 'submissions_paused', message: 'Submissions are paused' }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))

    const banner = await screen.findByTestId('problem-submit-error-banner')
    expect(banner.textContent).toContain('pausadas pela organização')
  })

  it('drops the raced 423 banner once the pause itself arrives, and leaves nothing stale on resume', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))
    mockedSubmit.mockResolvedValue(
      jsonResponse(423, { error: 'submissions_paused', message: 'Submissions are paused' }),
    )

    renderProblem()
    await screen.findByTestId('problem-submit-button')
    fireEvent.click(screen.getByTestId('problem-submit-button'))
    await screen.findByTestId('problem-submit-error-banner')

    emitSse({ type: 'submissions.paused', serverTime: new Date() })
    expect(screen.getByTestId('problem-submissions-paused-banner')).toBeDefined()
    expect(screen.queryByTestId('problem-submit-error-banner')).toBeNull()

    emitSse({ type: 'submissions.resumed', serverTime: new Date() })
    expect(screen.queryByTestId('problem-submissions-paused-banner')).toBeNull()
    expect(screen.queryByTestId('problem-submit-error-banner')).toBeNull()
  })

  it('does not show the paused banner on a closed round', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem({ roundStatus: 'closed' })))

    renderProblem()
    await screen.findByTestId('problem-closed-notice')
    emitSse({ type: 'submissions.paused', serverTime: new Date() })

    expect(screen.queryByTestId('problem-submissions-paused-banner')).toBeNull()
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

  // #155: the anchored layout. jsdom measures nothing, so these only pin the
  // skeleton the CSS depends on — the actual "inside the viewport" proof is the
  // Playwright walkthrough in `e2e/problem-layout.spec.ts`.
  it('keeps run, clear and submit inside the anchored actions bar', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

    renderProblem()

    const bar = await screen.findByTestId('problem-actions-bar')
    expect(bar.contains(screen.getByTestId('problem-run-button'))).toBe(true)
    expect(bar.contains(screen.getByTestId('problem-clear-button'))).toBe(true)
    expect(bar.contains(screen.getByTestId('problem-submit-button'))).toBe(true)
  })

  it('renders the run results and the verdict inside the results band', async () => {
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
    await screen.findByTestId('problem-run-button')
    expect(screen.queryByTestId('problem-results-band')).toBeNull()

    // The seeded workspace holds only the root block, so the run settles into
    // the "empty solution" notice without ever reaching a worker.
    fireEvent.click(screen.getByTestId('problem-run-button'))
    const band = await screen.findByTestId('problem-results-band')
    expect(band.contains(await screen.findByTestId('problem-results-panel'))).toBe(true)

    fireEvent.click(screen.getByTestId('problem-submit-button'))
    expect(band.contains(await screen.findByTestId('problem-verdict-panel'))).toBe(true)
  })

  it('stacks the notice above the canvas and the actions bar below the results band', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(200, participantProblem({ roundStatus: 'closed', roundId: null })),
    )

    renderProblem()
    const notice = await screen.findByTestId('problem-closed-notice')
    const canvas = screen.getByTestId('blockly-workspace')
    expect(notice.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByTestId('problem-run-button'))
    const band = await screen.findByTestId('problem-results-band')
    // The bar is the last thing in the panel: that is what pins it to the
    // bottom edge instead of letting the results push it off screen.
    expect(canvas.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      band.compareDocumentPosition(screen.getByTestId('problem-actions-bar')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  // #178: the editor subtree used to be torn down whenever the problem query
  // left `success` — a language switch (new query key → `isPending`) or a
  // failed refetch (SSE invalidates this query on every event). The remounted
  // editor came back with the state read at page load, and the next auto-save
  // wrote that over the good copy.
  describe('the editor across a language switch and a refetch (#178, #39)', () => {
    it('does not unmount the editor when the language changes', async () => {
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

      renderProblem()
      const editor = await screen.findByTestId('blockly-workspace')

      fireEvent.click(screen.getByTestId('language-option-es'))

      await waitFor(() => {
        expect(mockedGet).toHaveBeenCalledWith(expect.objectContaining({ query: { locale: 'es' } }))
      })
      // The very same DOM node: a remount would hand back a new one.
      expect(screen.getByTestId('blockly-workspace')).toBe(editor)
    })

    it('keeps the blocks on the canvas across a language switch', async () => {
      saveWorkspaceState(fakeUser.id, 'p1', savedWorkspace('blocoDoAluno'))
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

      renderProblem()
      await screen.findByTestId('blockly-workspace')
      expect(liveBlockIds()).toEqual(expect.arrayContaining(['blocoDoAluno']))

      fireEvent.click(screen.getByTestId('language-option-es'))

      await waitFor(() => {
        expect(mockedGet).toHaveBeenCalledWith(expect.objectContaining({ query: { locale: 'es' } }))
      })
      expect(liveBlockIds()).toHaveLength(2)
      expect(liveBlockIds()).toEqual(expect.arrayContaining(['blocoDoAluno']))
    })

    it('does not let the auto-save after a language switch overwrite the good copy', async () => {
      saveWorkspaceState(fakeUser.id, 'p1', savedWorkspace('blocoDoAluno'))
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

      renderProblem()
      await screen.findByTestId('blockly-workspace')

      fireEvent.click(screen.getByTestId('language-option-es'))
      await waitFor(() => {
        expect(mockedGet).toHaveBeenCalledWith(expect.objectContaining({ query: { locale: 'es' } }))
      })

      // Whatever the switch queues up, what lands in storage still holds the
      // participant's block.
      await waitFor(() => {
        expect(loadWorkspaceState(fakeUser.id, 'p1')?.blocks?.blocks).toHaveLength(2)
      })
      expect(blockIdsOf(loadWorkspaceState(fakeUser.id, 'p1'))).toEqual(
        expect.arrayContaining(['blocoDoAluno']),
      )
    })

    it('remounts the editor with the other problem workspace when navigating p1 → p2 (#39)', async () => {
      saveWorkspaceState(fakeUser.id, 'p1', savedWorkspace('blocoDeA'))
      saveWorkspaceState(fakeUser.id, 'p2', savedWorkspace('blocoDeB'))
      mockedGet.mockImplementation(async (args: { param: { id: string } }) =>
        jsonResponse(
          200,
          participantProblem({ id: args.param.id, title: `Problema ${args.param.id}` }),
        ),
      )

      const { router } = renderProblem()
      await screen.findByTestId('blockly-workspace')
      expect(liveBlockIds()).toEqual(expect.arrayContaining(['blocoDeA']))

      await act(async () => {
        await router.navigate({ to: '/problem/$id', params: { id: 'p2' } })
      })

      await waitFor(() => {
        expect(screen.getByTestId('problem-statement-panel').textContent).toContain('Problema p2')
      })
      await waitFor(() => {
        expect(liveBlockIds()).toEqual(expect.arrayContaining(['blocoDeB']))
      })
      expect(liveBlockIds()).not.toEqual(expect.arrayContaining(['blocoDeA']))
    })

    it('keeps the editor on screen when a refetch fails and the data is still there', async () => {
      mockedGet
        .mockResolvedValueOnce(jsonResponse(200, participantProblem()))
        .mockResolvedValue(jsonResponse(500, { error: 'internal', message: 'boom' }))

      const { queryClient } = renderProblem()
      const editor = await screen.findByTestId('blockly-workspace')

      await act(async () => {
        await queryClient.refetchQueries({ queryKey: ['problem', 'p1'] })
      })

      // The refetch really ran and really failed — without this the rest of
      // the test would pass on a query that never left `success`.
      expect(mockedGet).toHaveBeenCalledTimes(2)
      expect(screen.queryByTestId('problem-load-error')).toBeNull()
      expect(screen.getByTestId('blockly-workspace')).toBe(editor)
    })
  })

  describe('the problem letter in the round (#219)', () => {
    it("shows the round's letter for this problem", async () => {
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem({ roundId: 'r1' })))
      mockedRound.mockResolvedValue(
        jsonResponse(
          200,
          participantRound([
            { problemId: 'p0', position: 0 },
            { problemId: 'p1', position: 1 },
          ]),
        ),
      )

      renderProblem()

      // Through its own testid, never the panel's text: the card keeps
      // `sr-only` labels, and reading `textContent` would match a badge that
      // is not on screen at all.
      const badge = await screen.findByTestId('problem-position-badge')
      expect(badge.textContent).toBe('Problema B')
    })

    it('omits the letter outside a round, where there is no position to read', async () => {
      mockedGet.mockResolvedValue(
        jsonResponse(200, participantProblem({ roundId: null, roundStatus: 'closed' })),
      )

      renderProblem()
      await screen.findByTestId('problem-statement-panel')

      expect(screen.queryByTestId('problem-position-badge')).toBeNull()
      // A closed round leaves `roundId` null, so there is nothing to fetch.
      expect(mockedRound).not.toHaveBeenCalled()
    })

    it('keeps the screen usable when the round request fails', async () => {
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem({ roundId: 'r1' })))
      mockedRound.mockResolvedValue(jsonResponse(500, { error: 'internal', message: 'boom' }))

      renderProblem()

      expect(await screen.findByTestId('problem-statement-panel')).toBeDefined()
      await waitFor(() => expect(mockedRound).toHaveBeenCalled())
      expect(screen.queryByTestId('problem-position-badge')).toBeNull()
      expect(screen.getByTestId('problem-submit-button')).toBeDefined()
    })
  })

  describe('the team best score while the round is open (#206)', () => {
    const verdict201 = {
      submissionId: 's1',
      attemptNumber: 1,
      score: 20,
      maxScore: 20,
      cases: [{ hidden: false, index: 0, outcome: 'passed', expected: 6, actual: 6, ms: 3 }],
    }

    it('shows the team best score badge', async () => {
      withTeam()
      mockedGet.mockResolvedValue(
        jsonResponse(
          200,
          participantProblem({
            bestSubmission: { score: 7, achievedAt: '2026-09-02T12:05:00.000Z', attempts: 1 },
          }),
        ),
      )

      renderProblem()

      expect((await screen.findByTestId('problem-best-score-badge')).textContent).toContain('7')
      expect(screen.queryByTestId('problem-no-submission-badge')).toBeNull()
    })

    it('shows the "no submissions" badge when the team never submitted', async () => {
      withTeam()
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

      renderProblem()

      expect(await screen.findByTestId('problem-no-submission-badge')).toBeDefined()
      expect(screen.queryByTestId('problem-best-score-badge')).toBeNull()
    })

    it('shows no badge to a participant without a team', async () => {
      mockedGet.mockResolvedValue(jsonResponse(200, participantProblem()))

      renderProblem()

      expect(await screen.findByTestId('problem-statement-panel')).toBeDefined()
      await waitFor(() => expect(mockedTeams).toHaveBeenCalled())
      expect(screen.queryByTestId('problem-best-score-badge')).toBeNull()
      expect(screen.queryByTestId('problem-no-submission-badge')).toBeNull()
    })

    it('shows no badge on a closed round, where the notice keeps the score as before', async () => {
      withTeam()
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

      expect((await screen.findByTestId('problem-closed-best-score')).textContent).toContain('8')
      await waitFor(() => expect(mockedTeams).toHaveBeenCalled())
      expect(screen.queryByTestId('problem-best-score-badge')).toBeNull()
      expect(screen.queryByTestId('problem-no-submission-badge')).toBeNull()
    })

    it('shows no "no submissions" badge on a closed round the team never submitted', async () => {
      withTeam()
      mockedGet.mockResolvedValue(
        jsonResponse(
          200,
          participantProblem({ roundStatus: 'closed', roundId: null, bestSubmission: null }),
        ),
      )

      renderProblem()

      expect(await screen.findByTestId('problem-closed-never-submitted')).toBeDefined()
      await waitFor(() => expect(mockedTeams).toHaveBeenCalled())
      expect(screen.queryByTestId('problem-no-submission-badge')).toBeNull()
    })

    it('refetches the problem after a 201 and shows the new best without a reload', async () => {
      withTeam()
      mockedGet.mockResolvedValueOnce(jsonResponse(200, participantProblem()))
      mockedGet.mockResolvedValue(
        jsonResponse(
          200,
          participantProblem({
            bestSubmission: { score: 20, achievedAt: '2026-09-02T12:10:00.000Z', attempts: 1 },
          }),
        ),
      )
      mockedSubmit.mockResolvedValue(jsonResponse(201, verdict201))

      renderProblem()
      expect(await screen.findByTestId('problem-no-submission-badge')).toBeDefined()
      const roundCallsBefore = mockedRound.mock.calls.length

      fireEvent.click(screen.getByTestId('problem-submit-button'))

      expect((await screen.findByTestId('problem-best-score-badge')).textContent).toContain('20')
      expect(mockedGet).toHaveBeenCalledTimes(2)
      await waitFor(() => expect(mockedRound.mock.calls.length).toBeGreaterThan(roundCallsBefore))
      expect(screen.getByTestId('problem-verdict-panel')).toBeDefined()
    })
  })
})
