import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

vi.mock('@/lib/api', () => ({
  api: {
    teams: { $get: vi.fn() },
    rounds: Object.assign(vi.fn(), {
      $get: vi.fn(),
      ':id': { ranking: { $get: vi.fn() } },
    }),
    ranking: { $get: vi.fn() },
    problems: { ':id': { $get: vi.fn() } },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { EventRanking, RoundRanking, SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

import { POLL_WHILE_OFFLINE_MS } from './leaderboard'

const mockedTeams = vi.mocked(api.teams.$get)
const mockedRounds = vi.mocked(api.rounds.$get)
const mockedRoundRanking = vi.mocked(api.rounds[':id'].ranking.$get)
const mockedEventRanking = vi.mocked(api.ranking.$get)
const mockedProblem = vi.mocked(api.problems[':id'].$get)

const participant: SessionUser = {
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

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function emit(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

function emitStatus(status: 'connecting' | 'open' | 'reconnecting') {
  const onStatusChange = connectEventStream.mock.calls.at(-1)?.[1] as (s: string) => void
  act(() => onStatusChange(status))
}

const teamsEnvelope = (overrides: Partial<{ myTeamId: string | null }> = {}) => ({
  maxTeamSize: 4,
  mixingLocked: false,
  myTeamId: null,
  teams: [
    { id: 't1', name: 'Time 1', members: [{ university: 'pucrs', email: null }] },
    { id: 't2', name: 'Time 2', members: [{ university: 'merida', email: null }] },
  ],
  ...overrides,
})

const roundRanking: RoundRanking = {
  roundId: 'r1',
  roundName: 'Rodada 1',
  problemIds: ['p1'],
  teams: [
    {
      teamId: 't1',
      teamName: 'Time 1',
      rank: 1,
      totalScore: 100,
      totalAttempts: 1,
      tiebreakTimeMs: 5000,
      problems: [{ problemId: 'p1', score: 100, attempts: 1 }],
    },
    {
      teamId: 't2',
      teamName: 'Time 2',
      rank: 2,
      totalScore: 50,
      totalAttempts: 2,
      tiebreakTimeMs: 9000,
      problems: [{ problemId: 'p1', score: 50, attempts: 2 }],
    },
  ],
}

const eventRanking: EventRanking = {
  teams: [
    {
      teamId: 't1',
      teamName: 'Time 1',
      rank: 1,
      totalScore: 100,
      totalAttempts: 1,
      tiebreakTimeMs: 5000,
      rounds: [
        { roundId: 'r1', roundName: 'Rodada 1', score: 100, attempts: 1, tiebreakTimeMs: 5000 },
      ],
    },
    {
      teamId: 't2',
      teamName: 'Time 2',
      rank: 2,
      totalScore: 50,
      totalAttempts: 2,
      tiebreakTimeMs: 9000,
      rounds: [
        { roundId: 'r1', roundName: 'Rodada 1', score: 50, attempts: 2, tiebreakTimeMs: 9000 },
      ],
    },
  ],
}

function renderLeaderboard() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/leaderboard'] }),
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
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(vi.fn())
  mockedTeams.mockReset()
  mockedRounds.mockReset()
  mockedRoundRanking.mockReset()
  mockedEventRanking.mockReset()
  mockedProblem.mockReset()

  mockedTeams.mockResolvedValue(jsonResponse(200, teamsEnvelope()))
  mockedRounds.mockResolvedValue(jsonResponse(200, []))
  mockedRoundRanking.mockResolvedValue(jsonResponse(200, roundRanking))
  mockedEventRanking.mockResolvedValue(jsonResponse(200, eventRanking))
  mockedProblem.mockResolvedValue(jsonResponse(200, { title: 'Soma' }))

  setSession(participant, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('LeaderboardScreen — active round', () => {
  it('shows the round grid live, highlighting my team', async () => {
    mockedTeams.mockResolvedValue(jsonResponse(200, teamsEnvelope({ myTeamId: 't1' })))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    const row1 = screen.getByTestId('leaderboard-row-t1')
    expect(row1.textContent).toContain('Time 1')
    expect(row1.textContent).toContain('100')
    expect(screen.getByTestId('leaderboard-your-team-badge')).toBeDefined()
  })

  it('switches to the Geral tab and shows round columns', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))

    await waitFor(() => expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined())
    expect(screen.getByTestId('leaderboard-column-round-r1').textContent).toBe('Rodada 1')
  })
})

describe('LeaderboardScreen — round opens with zero submissions', () => {
  it('shows the round grid from REST as soon as round.opened arrives, before any ranking.updated', async () => {
    const emptyRoundRanking: RoundRanking = { ...roundRanking, teams: [] }
    mockedRoundRanking.mockResolvedValue(jsonResponse(200, emptyRoundRanking))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    // Simulates the connection's initial snapshot (state.sync + ranking.updated),
    // taken before the round opened — no active round yet.
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    await waitFor(() => expect(screen.getByTestId('leaderboard-empty-no-round')).toBeDefined())

    // The organizer opens a round while this client stays connected. No
    // submission has happened yet, so no fresh `ranking.updated` follows —
    // only `round.opened` — but the grid must still update (the reported bug).
    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })

    await waitFor(() => expect(mockedRoundRanking).toHaveBeenCalledWith({ param: { id: 'r1' } }))
    await waitFor(() => expect(screen.getByTestId('leaderboard-empty')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-empty-no-round')).toBeNull()
  })
})

describe('LeaderboardScreen — round closes live', () => {
  it('refetches rounds on round.closed so the last-closed label appears without a reload', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(200, []))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())

    // Organizer closes the round while this client stays connected — the
    // rounds list mock now reflects the closed round, simulating what the
    // API returns once refetched (the reported bug: nothing ever refetches
    // it, so `lastClosedRound` stays stuck on the pre-close snapshot).
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r1',
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T10:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T10:30:00.000Z'),
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })

    // Once a round has closed with nobody having picked a tab, the default
    // correctly settles on "Geral" (#111) — switch to "Rodada" to see the
    // last-closed label. The screen still flips through a loading state
    // while `rounds` and then `lastClosedRanking` resolve, so retry the
    // click until it lands past that; unlike before the #111 fix, once it
    // lands it sticks — no more losing the selection on a later remount.
    await waitFor(() => {
      fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-round'))
      expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined()
    })
    expect(screen.queryByTestId('leaderboard-empty-no-round')).toBeNull()
  })
})

describe('LeaderboardScreen — tab selection persists', () => {
  it('keeps the manually selected "Rodada" tab when a later round.closed recomputes the default to "Geral"', async () => {
    // Start with an *earlier* closed round (r0) already on record and no
    // active round — the computed default is "Geral" here (a round has
    // closed before and none is active), so switching to "Rodada" below is
    // a genuine value change, not a no-op click on an already-active tab.
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r0',
          name: 'Rodada 0',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T09:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T09:30:00.000Z'),
          createdAt: new Date('2026-09-01T08:00:00.000Z'),
          updatedAt: new Date('2026-09-01T09:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())

    // Manually switch to "Rodada" to look at r0's grid.
    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-round'))
    await waitFor(() => expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined())

    // Organizer closes a *different*, more recent round (r1) while this
    // client stays connected. Once the rounds refetch resolves, `r1`
    // supersedes `r0` as `lastClosedRound`, so the recomputed default is
    // still "Geral" — and a brand-new `lastClosedRanking` query key (keyed
    // on r1 now, never fetched before) briefly flips `isLoading` true,
    // which used to remount the (uncontrolled) Tabs and pick up that
    // recomputed default, kicking the participant out of "Rodada" even
    // though they had just switched to it.
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r0',
          name: 'Rodada 0',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T09:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T09:30:00.000Z'),
          createdAt: new Date('2026-09-01T08:00:00.000Z'),
          updatedAt: new Date('2026-09-01T09:30:00.000Z'),
          problemCount: 1,
        },
        {
          id: 'r1',
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T10:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T10:30:00.000Z'),
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    emit({ type: 'round.closed', serverTime: new Date(), roundId: 'r1' })

    // Wait for the *new* key's fetch — proof the recompute (and the
    // isLoading flip/remount it drives) actually happened, not just that
    // the label was already there from before r1 closed.
    await waitFor(() => expect(mockedRoundRanking).toHaveBeenCalledWith({ param: { id: 'r1' } }))

    // No re-click: "Rodada" must still be the one showing.
    await waitFor(() => expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-column-round-r1')).toBeNull()
  })

  it('keeps the manually selected "Geral" tab when round.opened recomputes the default to "Rodada"', async () => {
    // No round has ever existed — the computed default is "Rodada" here,
    // so switching to "Geral" below is a genuine value change.
    mockedRounds.mockResolvedValue(jsonResponse(200, []))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    await waitFor(() => expect(screen.getByTestId('leaderboard-empty-no-round')).toBeDefined())

    // Manually switch to "Geral".
    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))
    await waitFor(() => expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined())

    // The organizer opens a round while this client stays connected, with
    // no submission yet — only `round.opened`, no `ranking.updated` — so a
    // fresh `activeRoundRanking` query key becomes enabled and briefly
    // `isPending`, same isLoading-flip/remount mechanism as the round.closed
    // case above. The recomputed default flips to "Rodada" (there's now an
    // active round), which used to override the participant's manual
    // "Geral" selection on remount.
    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })

    // No re-click: "Geral" must still be the one showing.
    await waitFor(() => expect(mockedRoundRanking).toHaveBeenCalledWith({ param: { id: 'r1' } }))
    await waitFor(() => expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-empty-no-round')).toBeNull()
  })
})

describe('LeaderboardScreen — no active round', () => {
  it('shows the last closed round under "Rodada" and opens on "Geral" by default', async () => {
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r1',
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T10:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T10:30:00.000Z'),
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })

    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())
    expect(screen.getByTestId('leaderboard-table')).toBeDefined()
    expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined()

    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-round'))
    await waitFor(() => expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined())
    expect(screen.getByTestId('leaderboard-last-closed-label').textContent).toContain('Rodada 1')
    expect(screen.getByTestId('leaderboard-row-t1')).toBeDefined()
  })

  it('shows a dedicated empty state under "Rodada" when no round ever existed', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(200, []))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: null,
      event: { teams: [] },
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-empty-no-round')).toBeDefined())
  })
})

describe('LeaderboardScreen — SSE never connects (REST fallback)', () => {
  // The reported bug (#180): `isLoading` included `stream.event === null`,
  // which is exactly the condition that enables the REST fallback — so the
  // fallback fetched the data and the screen never left the loading state.
  it('renders the ranking from the REST fallback when the stream delivers nothing', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())

    // No emit(): the stream stays silent for the whole test, as it does when
    // /sse is blocked by a proxy or the venue's network.
    await waitFor(() => expect(screen.queryByTestId('leaderboard-loading')).toBeNull())
    expect(mockedEventRanking).toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    expect(screen.getByTestId('leaderboard-row-t1').textContent).toContain('Time 1')
  })

  // Same root cause: the error branch was `!isLoading && isError`, so it was
  // unreachable for as long as isLoading was stuck true.
  it('reaches the error state with a working retry when every REST call fails too', async () => {
    mockedTeams.mockResolvedValue(jsonResponse(500, {}))
    mockedRounds.mockResolvedValue(jsonResponse(500, {}))
    mockedRoundRanking.mockResolvedValue(jsonResponse(500, {}))
    mockedEventRanking.mockResolvedValue(jsonResponse(500, {}))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-error')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-loading')).toBeNull()

    const retry = screen.getByTestId('leaderboard-error-retry')
    mockedEventRanking.mockClear()
    fireEvent.click(retry)
    await waitFor(() => expect(mockedEventRanking).toHaveBeenCalled())
  })

  // Data first: a partial failure must never hide a ranking that did load.
  it('keeps showing the ranking when only the rounds list fails', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(500, {}))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    await waitFor(() => expect(screen.queryByTestId('leaderboard-loading')).toBeNull())
    expect(screen.queryByTestId('leaderboard-error')).toBeNull()

    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
  })
})

const openRoundSummary = {
  id: 'r1',
  name: 'Rodada 1',
  status: 'open',
  durationMinutes: 30,
  openedAt: '2026-09-05T12:00:00.000Z',
  closesAt: '2026-09-05T13:00:00.000Z',
  closedAt: null,
  createdAt: '2026-09-05T11:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
  problemCount: 1,
}

describe('LeaderboardScreen — active round without the stream', () => {
  // `hasActiveRound` derived from `stream.activeRoundId` alone: with the
  // stream dead, an open round was invisible and the "Rodada" tab showed the
  // last *closed* round instead — the wrong round on the venue's big screen.
  it('derives the open round from GET /rounds when the stream never connects', async () => {
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        openRoundSummary,
        {
          id: 'r0',
          name: 'Rodada 0',
          status: 'closed',
          durationMinutes: 30,
          openedAt: '2026-09-05T10:00:00.000Z',
          closesAt: null,
          closedAt: '2026-09-05T10:30:00.000Z',
          createdAt: '2026-09-05T09:00:00.000Z',
          updatedAt: '2026-09-05T10:30:00.000Z',
          problemCount: 1,
        },
      ]),
    )
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    await waitFor(() => expect(mockedRoundRanking).toHaveBeenCalledWith({ param: { id: 'r1' } }))
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())

    expect(screen.queryByTestId('leaderboard-last-closed-label')).toBeNull()
    expect(screen.getByTestId('leaderboard-row-t1').textContent).toContain('Time 1')
  })

  // Precedence: while the stream is live the SSE payload wins; once it is
  // down, the REST poll is the fresher source and replaces the frozen
  // snapshot instead of being shadowed by it.
  it('lets a fresher REST result replace the frozen SSE snapshot once the stream is down', async () => {
    mockedRoundRanking.mockResolvedValue(
      jsonResponse(200, {
        ...roundRanking,
        teams: [
          {
            ...roundRanking.teams[0],
            totalScore: 250,
            problems: [{ problemId: 'p1', score: 250, attempts: 1 }],
          },
          roundRanking.teams[1],
        ],
      }),
    )
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())

    // The snapshot the stream managed to deliver before dying (100 points).
    // `emitStatus('open')` is never called, so the stream counts as down.
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-row-t1').textContent).toContain('250'),
    )
  })
})

describe('LeaderboardScreen — REST poll while the stream is down', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('re-fetches the event ranking every POLL_WHILE_OFFLINE_MS', async () => {
    renderLeaderboard()
    await waitFor(() => expect(mockedEventRanking).toHaveBeenCalled())
    mockedEventRanking.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_WHILE_OFFLINE_MS)
    })

    await waitFor(() => expect(mockedEventRanking).toHaveBeenCalled())
  })

  it('does not poll while the stream is live', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emitStatus('open')
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())
    mockedEventRanking.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_WHILE_OFFLINE_MS * 3)
    })

    expect(mockedEventRanking).not.toHaveBeenCalled()
  })
})

describe('LeaderboardScreen — connection banner', () => {
  it('shows a banner while connecting/reconnecting and hides it once open', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-connection-banner')).toBeDefined())

    emitStatus('open')
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.queryByTestId('leaderboard-connection-banner')).toBeNull())

    emitStatus('reconnecting')
    await waitFor(() => expect(screen.getByTestId('leaderboard-connection-banner')).toBeDefined())
  })
})

describe('LeaderboardScreen — empty state', () => {
  it('shows the empty state when the round has zero teams', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: { ...roundRanking, teams: [] },
      event: { teams: [] },
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-empty')).toBeDefined())
  })
})

describe('LeaderboardScreen — presentation mode', () => {
  beforeEach(() => {
    HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })
  })

  async function renderWithActiveRound() {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date('2026-09-05T13:00:00.000Z'),
    })
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
  }

  it('enters presentation mode on toggle click and requests fullscreen', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)

    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('exits presentation mode when the browser reports fullscreen exit (Esc path)', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    act(() => document.dispatchEvent(new Event('fullscreenchange')))

    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('exits presentation mode via the toggle itself, calling exitFullscreen', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    fireEvent.click(toggle)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.querySelector('main'),
    })

    fireEvent.click(toggle)

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('degrades gracefully when requestFullscreen rejects', async () => {
    HTMLElement.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'))
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('paints an opaque background on the fullscreened main so the browser backdrop never shows through', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(document.querySelector('main')?.className).toContain('bg-background')
  })

  it('hides the round countdown in normal mode even with an active round', async () => {
    await renderWithActiveRound()

    expect(screen.queryByTestId('round-countdown')).toBeNull()
  })

  it('shows the round countdown once presentation mode is toggled on', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(screen.getByTestId('round-countdown')).toBeDefined()
  })

  it('hides the round countdown in presentation mode when there is no active round', async () => {
    mockedRounds.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'r1',
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: new Date('2026-09-01T10:00:00.000Z'),
          closesAt: null,
          closedAt: new Date('2026-09-01T10:30:00.000Z'),
          createdAt: new Date('2026-09-01T09:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:30:00.000Z'),
          problemCount: 1,
        },
      ]),
    )
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })
    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(screen.queryByTestId('round-countdown')).toBeNull()
  })
})
