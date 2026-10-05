import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    rounds: Object.assign(vi.fn(), {
      ':id': { $get: vi.fn() },
    }),
    teams: { $get: vi.fn() },
  },
}))

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseConnectionStatus } from '@/lib/sse-client'
import type { SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedGet = vi.mocked(api.rounds[':id'].$get)
const mockedTeamsGet = vi.mocked(api.teams.$get)
const sseUnsubscribe = vi.fn()

// Since #274 this screen reads the app-wide connection opened by
// `RoundStreamProvider` in `__root` instead of opening a second one of its
// own, so there is exactly one `connectEventStream` call to drive.
function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls[0]?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

function emitStatus(status: SseConnectionStatus) {
  const onStatusChange = connectEventStream.mock.calls[0]?.[1] as (s: SseConnectionStatus) => void
  act(() => onStatusChange(status))
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

// GET /teams tells the screen whether the caller has a team (#206): with one,
// a null bestSubmission means "no submissions"; without, it is just unavailable.
function withTeam() {
  mockedTeamsGet.mockResolvedValue(jsonResponse(200, { myTeamId: 't1', teams: [] }))
}

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function roundDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'open',
    durationMinutes: 30,
    openedAt: '2026-09-02T12:00:00.000Z',
    closesAt: '2026-09-02T12:30:00.000Z',
    closedAt: null,
    problems: [
      {
        problemId: 'p1',
        position: 0,
        title: 'Soma',
        difficulty: 'easy',
        points: 10,
        bestSubmission: null,
      },
    ],
    ...overrides,
  }
}

function renderRound(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/rounds/r1'] }),
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
  mockedTeamsGet.mockReset()
  mockedTeamsGet.mockResolvedValue(jsonResponse(200, { myTeamId: null, teams: [] }))
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(sseUnsubscribe)
  sseUnsubscribe.mockClear()
  setSession(fakeUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('RoundDetailScreen', () => {
  it('shows a loading state before the round resolves', async () => {
    mockedGet.mockReturnValue(new Promise(() => {}))

    renderRound()

    expect(await screen.findByTestId('round-detail-loading')).toBeDefined()
  })

  it('renders the not-found state for an unknown round', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(404, { error: 'not_found', message: 'Round not found' }),
    )

    renderRound()

    expect(await screen.findByTestId('round-detail-not-found')).toBeDefined()
  })

  it('renders the same not-found state for a malformed round id (#94)', async () => {
    mockedGet.mockResolvedValue(jsonResponse(422, { error: 'validation_failed', issues: {} }))

    renderRound()

    expect(await screen.findByTestId('round-detail-not-found')).toBeDefined()
  })

  it('shows the unavailable placeholder to a teamless participant and the live countdown for an open round tracked by the event stream', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()

    expect(await screen.findByTestId('round-problem-p1')).toBeDefined()
    expect(screen.getByTestId('round-problem-p1').textContent).toContain('—')
    expect(screen.queryByTestId('round-countdown')).toBeNull()
    expect(screen.getByTestId('round-problem-p1').querySelector('a')?.getAttribute('href')).toBe(
      '/problem/p1',
    )

    emitSse({
      type: 'state.sync',
      submissionsPaused: false,
      serverTime: new Date('2026-09-02T12:10:00.000Z'),
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })

    // Scoped to <main>: the header renders its own chip off the same shared
    // connection since #274 (see emitSse above).
    await waitFor(() =>
      expect(within(screen.getByRole('main')).getByTestId('round-countdown')).toBeDefined(),
    )
  })

  it('shows the real best score once closed, and the unavailable placeholder to a teamless participant', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(
        200,
        roundDetail({
          status: 'closed',
          closedAt: '2026-09-02T13:00:00.000Z',
          problems: [
            {
              problemId: 'p1',
              position: 0,
              title: 'Soma',
              difficulty: 'easy',
              points: 10,
              bestSubmission: { score: 8, maxScore: 20 },
            },
            {
              problemId: 'p2',
              position: 1,
              title: 'Produto',
              difficulty: 'medium',
              points: 20,
              bestSubmission: null,
            },
          ],
        }),
      ),
    )

    renderRound()

    expect(await screen.findByTestId('round-problem-p1')).toBeDefined()
    expect(screen.getByTestId('round-problem-best-score-p1').textContent).toMatch(/\b8\/20$/)
    expect(screen.getByTestId('round-problem-p2').textContent).toContain('—')
    expect(screen.queryByTestId('round-countdown')).toBeNull()
    expect(screen.getByTestId('round-problem-p1').querySelector('a')?.getAttribute('href')).toBe(
      '/problem/p1',
    )
    expect(screen.getByTestId('round-problem-p2').querySelector('a')?.getAttribute('href')).toBe(
      '/problem/p2',
    )
  })

  describe('best score (#206)', () => {
    function twoProblems(status: 'open' | 'closed') {
      return roundDetail({
        status,
        closedAt: status === 'closed' ? '2026-09-02T13:00:00.000Z' : null,
        problems: [
          {
            problemId: 'p1',
            position: 0,
            title: 'Soma',
            difficulty: 'easy',
            points: 10,
            bestSubmission: { score: 8, maxScore: 20 },
          },
          {
            problemId: 'p2',
            position: 1,
            title: 'Produto',
            difficulty: 'medium',
            points: 20,
            bestSubmission: null,
          },
        ],
      })
    }

    it('shows the team best score while the round is open', async () => {
      withTeam()
      mockedGet.mockResolvedValue(jsonResponse(200, twoProblems('open')))

      renderRound()

      const cell = await screen.findByTestId('round-problem-best-score-p1')
      expect(cell.textContent).toMatch(/\b8\/20$/)
      expect(cell.getAttribute('data-state')).toBe('score')
    })

    // #421: the cell's maximum is the one the score was judged against, not
    // the points column beside it — which says what the problem is worth now,
    // after the organizer changed it on the closed round.
    it('shows score/stamped maximum beside the current points once closed', async () => {
      withTeam()
      mockedGet.mockResolvedValue(
        jsonResponse(
          200,
          roundDetail({
            status: 'closed',
            closedAt: '2026-09-02T13:00:00.000Z',
            problems: [
              {
                problemId: 'p1',
                position: 0,
                title: 'Soma',
                difficulty: 'easy',
                points: 250,
                bestSubmission: { score: 50, maxScore: 100 },
              },
            ],
          }),
        ),
      )

      renderRound()

      const cell = await screen.findByTestId('round-problem-best-score-p1')
      expect(screen.getByTestId('round-problem-points-p1').textContent).toMatch(/\b250$/)
      expect(cell.textContent).toMatch(/\b50\/100$/)
      expect(cell.textContent).not.toContain('250')
      expect(cell.getAttribute('data-state')).toBe('score')
    })

    it('shows "no submissions" for a problem the team never submitted', async () => {
      withTeam()
      mockedGet.mockResolvedValue(jsonResponse(200, twoProblems('open')))

      renderRound()

      await waitFor(() =>
        expect(screen.getByTestId('round-problem-best-score-p2').getAttribute('data-state')).toBe(
          'none',
        ),
      )
      expect(screen.getByTestId('round-problem-best-score-p2').textContent).toContain(
        'Sem submissão',
      )
    })

    it('shows "no submissions" on a closed round too when the team has one', async () => {
      withTeam()
      mockedGet.mockResolvedValue(jsonResponse(200, twoProblems('closed')))

      renderRound()

      await waitFor(() =>
        expect(screen.getByTestId('round-problem-best-score-p2').getAttribute('data-state')).toBe(
          'none',
        ),
      )
      expect(screen.getByTestId('round-problem-best-score-p1').textContent).toMatch(/\b8\/20$/)
    })

    it('shows the unavailable placeholder when the participant has no team', async () => {
      mockedGet.mockResolvedValue(jsonResponse(200, twoProblems('open')))

      renderRound()

      const cell = await screen.findByTestId('round-problem-best-score-p2')
      await waitFor(() => expect(mockedTeamsGet).toHaveBeenCalled())
      expect(cell.getAttribute('data-state')).toBe('unavailable')
      expect(cell.textContent).toContain('—')
    })

    it('falls back to the unavailable placeholder, with no error state, when GET /teams fails', async () => {
      mockedTeamsGet.mockResolvedValue(jsonResponse(500, { error: 'boom' }))
      mockedGet.mockResolvedValue(jsonResponse(200, twoProblems('open')))

      renderRound()

      const cell = await screen.findByTestId('round-problem-best-score-p2')
      await waitFor(() => expect(mockedTeamsGet).toHaveBeenCalled())
      expect(cell.getAttribute('data-state')).toBe('unavailable')
      expect(screen.getByTestId('round-problem-best-score-p1').textContent).toMatch(/\b8\/20$/)
      expect(screen.queryByTestId('round-detail-load-error')).toBeNull()
    })
  })

  it('shows and hides the connection indicator as the event stream status changes', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()
    await screen.findByTestId('round-problem-p1')

    expect(screen.queryByTestId('round-connection-status')).toBeNull()

    emitStatus('reconnecting')
    expect(screen.getByTestId('round-connection-status')).toBeDefined()

    emitStatus('open')
    expect(screen.queryByTestId('round-connection-status')).toBeNull()
  })

  // #189: 'error' is the status a rejected `/sse` or an exhausted retry cap
  // reports. This screen has no REST fallback, so the indicator is the only
  // thing telling a participant mid-round that the countdown and the ranking
  // have stopped moving — it must not stay silent just because the status is
  // not the literal 'reconnecting'.
  it('shows the connection indicator on the error status too', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()
    await screen.findByTestId('round-problem-p1')

    emitStatus('error')
    expect(screen.getByTestId('round-connection-status')).toBeDefined()

    emitStatus('open')
    expect(screen.queryByTestId('round-connection-status')).toBeNull()
  })

  it('shows the just-closed notice exactly once when the round flips to closed, and it can be dismissed', async () => {
    mockedGet
      .mockResolvedValueOnce(jsonResponse(200, roundDetail()))
      .mockResolvedValueOnce(
        jsonResponse(200, roundDetail({ status: 'closed', closedAt: '2026-09-02T13:00:00.000Z' })),
      )

    renderRound()
    await screen.findByTestId('round-problem-p1')
    expect(screen.queryByTestId('round-just-closed-notice')).toBeNull()

    emitSse({
      type: 'round.closed',
      serverTime: new Date('2026-09-02T13:00:00.000Z'),
      roundId: 'r1',
    })

    await waitFor(() => {
      expect(screen.getByTestId('round-just-closed-notice')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Dispensar'))
    expect(screen.queryByTestId('round-just-closed-notice')).toBeNull()
  })

  it('shows the empty-round card when the round has no problems', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail({ problems: [] })))

    renderRound()

    expect(await screen.findByTestId('round-detail-empty')).toBeDefined()
    expect(screen.queryByTestId('round-problems-table')).toBeNull()
  })

  it('does not show the just-closed notice when the round is already closed on first load', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(200, roundDetail({ status: 'closed', closedAt: '2026-09-02T13:00:00.000Z' })),
    )

    renderRound()

    await screen.findByTestId('round-problem-p1')
    expect(screen.queryByTestId('round-just-closed-notice')).toBeNull()
  })

  it('shows the countdown and hides the closed-at time for an open round', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()
    await screen.findByTestId('round-problem-p1')

    emitSse({
      type: 'state.sync',
      submissionsPaused: false,
      serverTime: new Date('2026-09-02T12:10:00.000Z'),
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })

    // Scoped to the screen's own <main>: since #274 the header shares this one
    // connection, so it renders its own `round-countdown` chip for the open
    // round too — exactly as it always did in the browser.
    await screen.findByTestId('round-detail-status-badge')
    expect(within(screen.getByRole('main')).getByTestId('round-countdown')).toBeDefined()
    expect(screen.queryByTestId('round-detail-closed-at')).toBeNull()
    expect(screen.getByTestId('round-detail-status-badge').textContent).toBe('Aberta')
  })

  it('marks the problems table with role="table" and labels each row with its position letter', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()

    expect((await screen.findByTestId('round-problems-table')).getAttribute('role')).toBe('table')
    expect(screen.getByTestId('round-problem-p1').textContent).toContain('A')
  })

  it('labels rows A, B in position order even when the API returns them out of order', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(
        200,
        roundDetail({
          problems: [
            {
              problemId: 'p2',
              position: 1,
              title: 'Produto',
              difficulty: 'medium',
              points: 20,
              bestSubmission: null,
            },
            {
              problemId: 'p1',
              position: 0,
              title: 'Soma',
              difficulty: 'easy',
              points: 10,
              bestSubmission: null,
            },
          ],
        }),
      ),
    )

    renderRound()

    expect(await screen.findByTestId('round-problem-p1')).toBeDefined()
    expect(screen.getByTestId('round-problem-p1').textContent).toContain('A')
    expect(screen.getByTestId('round-problem-p2').textContent).toContain('B')
  })

  it('shows the closed-at time and hides the countdown for a closed round', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(200, roundDetail({ status: 'closed', closedAt: '2026-09-02T13:05:00.000Z' })),
    )

    renderRound()

    expect(await screen.findByTestId('round-detail-closed-at')).toBeDefined()
    expect(screen.queryByTestId('round-countdown')).toBeNull()
    expect(screen.getByTestId('round-detail-status-badge').textContent).toBe('Encerrada')
  })
})
