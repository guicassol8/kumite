import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

import { OFFLINE_AFTER_MS } from '@/hooks/use-leaderboard-stream'
import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import {
  type EventRanking,
  type RoundRanking,
  type RoundRankingTeam,
  type SseEvent,
  SseEventSchema,
} from '@/lib/sse-schema'
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
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

// Since #274 there is exactly ONE connection on this screen — the app-wide one
// opened by `RoundStreamProvider` in `__root`, which the leaderboard now reads
// from instead of opening a second one of its own. So the latest call is
// always the live connection, including the one `reconnect()` opens.
function emit(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

function emitStatus(status: 'connecting' | 'open' | 'reconnecting' | 'error') {
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
  denominators: 'consistent',
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

describe('LeaderboardScreen — identity redesign (#220)', () => {
  it('shows problem columns as letters with the full title in a `title` attribute and in the legend', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    const column = screen.getByTestId('leaderboard-column-problem-p1')
    expect(column.textContent).toBe('A')
    await waitFor(() => expect(column.getAttribute('title')).toBe('Soma'))

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-legend-item-p1').textContent).toBe('A — Soma'),
    )
  })

  it('keeps the table wide and the team column sticky instead of scrolling horizontally', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    const table = screen.getByTestId('leaderboard-table')
    expect(table.tagName).toBe('TABLE')
    expect(table.className).not.toContain('overflow')
    const teamColumn = screen.getByTestId('leaderboard-column-team')
    expect(teamColumn.className).toContain('sticky')
  })

  it('distinguishes a zero score from no submission on a problem column', async () => {
    const teamWithZeroScore: RoundRankingTeam = {
      ...roundRanking.teams[0]!,
      problems: [{ problemId: 'p1', score: 0, attempts: 1 }],
    }
    const teamWithNoSubmission: RoundRankingTeam = { ...roundRanking.teams[1]!, problems: [] }
    const roundWithDistinctScores: RoundRanking = {
      ...roundRanking,
      teams: [teamWithZeroScore, teamWithNoSubmission],
    }
    mockedRoundRanking.mockResolvedValue(jsonResponse(200, roundWithDistinctScores))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundWithDistinctScores,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    expect(screen.getByTestId('leaderboard-row-t1').textContent).toContain('0')
    expect(screen.getByTestId('leaderboard-row-t2').textContent).toContain('—')
  })

  it('colors the rank numeral by position and fills the "Seu time" badge solid', async () => {
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
    const rankSpan = row1.querySelector('.font-display.tabular-nums')
    expect(rankSpan?.className).toContain('text-brand-text')

    const badge = screen.getByTestId('leaderboard-your-team-badge')
    expect(badge.getAttribute('data-variant')).toBe('brand')
    expect(row1.className).toContain('bg-brand-soft')
  })

  it('names the score cells on screen in the card layout, leaving rank and team to read for themselves', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
    const cells = [...screen.getByTestId('leaderboard-row-t1').querySelectorAll('td')]
    const labelOf = (index: number) => cells[index]?.querySelector('span')
    // rank, team, problem A, total — in that column order.
    expect(labelOf(0)?.className).toContain('sr-only')
    expect(labelOf(1)?.className).toContain('sr-only')
    expect(labelOf(2)?.className).not.toContain('sr-only')
    expect(labelOf(3)?.className).not.toContain('sr-only')
    expect(labelOf(3)?.textContent?.trim()).toBe('Total:')
  })

  it('shows the live chip and brand-text countdown whenever a round is active', async () => {
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

    await waitFor(() => expect(screen.getByTestId('leaderboard-live-chip')).toBeDefined())
    // Scoped to the screen's own <main>: since #274 the header shares this one
    // connection, so it renders its own `round-countdown` chip as soon as the
    // round opens — exactly as it always did in the browser.
    expect(within(screen.getByRole('main')).getByTestId('round-countdown').className).toContain(
      'text-brand-text',
    )
  })
})

describe('LeaderboardScreen — alert-styled states (#220)', () => {
  it('shows the error state as a destructive Alert with a retry action', async () => {
    mockedTeams.mockResolvedValue(jsonResponse(500, {}))
    mockedRounds.mockResolvedValue(jsonResponse(500, {}))
    mockedRoundRanking.mockResolvedValue(jsonResponse(500, {}))
    mockedEventRanking.mockResolvedValue(jsonResponse(500, {}))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-error')).toBeDefined())
    const alert = screen.getByTestId('leaderboard-error')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.querySelector('svg')).not.toBeNull()
  })

  it('shows the connection banner as a warning Alert with an icon while reconnecting', async () => {
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
    await waitFor(() => {
      const banner = screen.getByTestId('leaderboard-connection-banner')
      expect(banner.className).toContain('border-warning')
      expect(banner.querySelector('svg')).not.toBeNull()
    })
  })

  // #189 added 'error' to the status union — a rejected `/sse` response or the
  // retry cap running out. It is a disconnection like any other, so the board
  // has to warn exactly as it does for 'reconnecting'; a default-variant
  // banner would understate a stream that is not coming back on its own.
  it('warns the same way on the error status', async () => {
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

    emitStatus('error')
    await waitFor(() => {
      const banner = screen.getByTestId('leaderboard-connection-banner')
      expect(banner.className).toContain('border-warning')
      expect(banner.querySelector('svg')).not.toBeNull()
    })
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

describe('LeaderboardScreen — offline signalling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('switches the banner to the offline copy and raises the "not live" badge', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-connection-banner')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-not-live-badge')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_AFTER_MS)
    })

    await waitFor(() => expect(screen.getByTestId('leaderboard-not-live-badge')).toBeDefined())
    expect(screen.getByTestId('leaderboard-connection-banner').textContent).toContain(
      'Sem conexão ao vivo',
    )

    emitStatus('open')
    await waitFor(() => expect(screen.queryByTestId('leaderboard-not-live-badge')).toBeNull())
    expect(screen.queryByTestId('leaderboard-connection-banner')).toBeNull()
  })
})

describe('LeaderboardScreen — the stream drops after connecting', () => {
  // Acceptance #5: losing a stream that had already delivered a ranking must
  // never send the venue's big screen back to the loading state.
  it('keeps the last ranking on screen instead of falling back to loading', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emitStatus('open')
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: roundRanking,
      event: eventRanking,
    })
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())

    emitStatus('reconnecting')

    await waitFor(() => expect(screen.getByTestId('leaderboard-connection-banner')).toBeDefined())
    expect(screen.getByTestId('leaderboard-table')).toBeDefined()
    expect(screen.queryByTestId('leaderboard-loading')).toBeNull()
    expect(screen.getByTestId('leaderboard-row-t1').textContent).toContain('Time 1')
  })
})

describe('LeaderboardScreen — retry', () => {
  it('forces a stream reconnect on top of refetching every REST query', async () => {
    mockedTeams.mockResolvedValue(jsonResponse(500, {}))
    mockedRounds.mockResolvedValue(jsonResponse(500, {}))
    mockedRoundRanking.mockResolvedValue(jsonResponse(500, {}))
    mockedEventRanking.mockResolvedValue(jsonResponse(500, {}))
    renderLeaderboard()

    await waitFor(() => expect(screen.getByTestId('leaderboard-error')).toBeDefined())
    // One connection for the whole screen (#274) — the retry reopens that one,
    // rather than a second socket only this route could see.
    expect(connectEventStream.mock.calls).toHaveLength(1)

    fireEvent.click(screen.getByTestId('leaderboard-error-retry'))

    await waitFor(() => expect(connectEventStream.mock.calls).toHaveLength(2))
  })
})

describe('LeaderboardScreen — empty state', () => {
  it('shows the round-specific empty copy when the round has zero teams', async () => {
    // The REST fallback (activeRoundRanking) fetches as soon as an active
    // round id shows up, regardless of stream.isLive in a test that never
    // emits a connection-status event — it must agree with the empty round
    // below, or the screen flips to the default non-empty fixture once that
    // fetch resolves.
    mockedRoundRanking.mockResolvedValue(jsonResponse(200, { ...roundRanking, teams: [] }))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: { ...roundRanking, teams: [] },
      event: { teams: [] },
    })

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-empty').textContent).toContain(
        'Ninguém submeteu nesta rodada ainda.',
      ),
    )
  })

  // #184: a closed round with no submissions must still identify itself by
  // name via the last-closed label — that label used to live only inside the
  // table branch, so a closed-but-empty round showed neither the table nor
  // any indication of which round this was.
  it('shows the last-closed label alongside the empty state for a closed round with zero teams', async () => {
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
    mockedRoundRanking.mockResolvedValue(jsonResponse(200, { ...roundRanking, teams: [] }))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({ type: 'ranking.updated', serverTime: new Date(), round: null, event: eventRanking })

    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())
    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-round'))

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-last-closed-label').textContent).toContain('Rodada 1'),
    )
    await waitFor(() => expect(screen.getByTestId('leaderboard-empty')).toBeDefined())
  })

  // The "Geral" tab keeps the generic copy — a team with zero points there is
  // legitimate (it just hasn't scored yet), not a filtered-out non-participant.
  it('keeps the generic empty copy on the "Geral" tab', async () => {
    // Same REST-fallback race as above, on the event-ranking side: eventRankingRest
    // fetches whenever the stream isn't marked live, so it must agree with
    // the empty event ranking below.
    mockedRoundRanking.mockResolvedValue(jsonResponse(200, { ...roundRanking, teams: [] }))
    mockedEventRanking.mockResolvedValue(jsonResponse(200, { teams: [] }))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emit({
      type: 'ranking.updated',
      serverTime: new Date(),
      round: { ...roundRanking, teams: [] },
      event: { teams: [] },
    })
    await waitFor(() => expect(screen.getByTestId('leaderboard-tabs')).toBeDefined())

    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-empty').textContent).toContain(
        'Nenhum time no placar ainda.',
      ),
    )
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

  // The toggle's testid is the same enter/exit control throughout, but once
  // presentation mode is active the element carrying it is TelaoBoard's own
  // exit button, not the small icon that opened it (#220 T12) — so each
  // assertion after a state change re-queries by testid instead of holding
  // on to the (by-then-unmounted) original node.
  it('enters presentation mode on toggle click and requests fullscreen', async () => {
    await renderWithActiveRound()

    const toggle = screen.getByTestId('leaderboard-presentation-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)

    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('leaderboard-presentation-toggle').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('exits presentation mode when the browser reports fullscreen exit (Esc path)', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))
    expect(screen.getByTestId('leaderboard-presentation-toggle').getAttribute('aria-pressed')).toBe(
      'true',
    )

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    act(() => document.dispatchEvent(new Event('fullscreenchange')))

    expect(screen.getByTestId('leaderboard-presentation-toggle').getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('exits presentation mode via the toggle itself, calling exitFullscreen', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.querySelector('main'),
    })

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('leaderboard-presentation-toggle').getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('degrades gracefully when requestFullscreen rejects', async () => {
    HTMLElement.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'))
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(screen.getByTestId('leaderboard-presentation-toggle').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('returns focus to the toggle that opened it once presentation mode exits', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))
    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId('leaderboard-presentation-toggle')),
    )
  })

  it('stays escapable when the telão is opened before any ranking has loaded', async () => {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))
    // Gating TelaoBoard on having data used to leave the projector on a
    // blank fullscreen with both exit listeners unmounted (#220 review).
    expect(screen.getByTestId('telao-board')).toBeDefined()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    await waitFor(() =>
      expect(
        screen.getByTestId('leaderboard-presentation-toggle').getAttribute('aria-pressed'),
      ).toBe('false'),
    )
  })

  it('paints an opaque background on the fullscreened main so the browser backdrop never shows through', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(document.querySelector('main')?.className).toContain('bg-background')
  })

  it('shows the round countdown and live chip in normal mode with an active round (#220)', async () => {
    await renderWithActiveRound()

    // Scoped to <main> for the same reason as above: the header's own chip is
    // a second `round-countdown` once the shared stream reports a live round.
    expect(within(screen.getByRole('main')).getByTestId('round-countdown')).toBeDefined()
    expect(screen.getByTestId('leaderboard-live-chip')).toBeDefined()
  })

  it('shows the round countdown once presentation mode is toggled on', async () => {
    await renderWithActiveRound()

    fireEvent.click(screen.getByTestId('leaderboard-presentation-toggle'))

    expect(screen.getByTestId('round-countdown')).toBeDefined()
  })

  it('shows the round countdown from the REST open round when the stream never connects', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(200, [openRoundSummary]))
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())

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

// #318: the round ranking's comparability verdict (#193), shown only to the
// organizer, only on the Rodada tab.
describe('LeaderboardScreen — denominators (#318)', () => {
  const organizer: SessionUser = { ...participant, id: 'u-org', role: 'organizer' }
  const closedRound = {
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
  }

  // The last closed round arrives over REST; with a closed round the default
  // tab is Geral (#111), so land on Rodada first.
  async function renderClosedRound(verdict: RoundRanking['denominators']) {
    mockedRounds.mockResolvedValue(jsonResponse(200, [closedRound]))
    mockedRoundRanking.mockResolvedValue(
      jsonResponse(200, { ...roundRanking, denominators: verdict }),
    )
    renderLeaderboard()
    await waitFor(() => {
      fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-round'))
      expect(screen.getByTestId('leaderboard-last-closed-label')).toBeDefined()
    })
  }

  // `sse-client` is mocked on this screen, so its zod parse never runs here:
  // do it by hand over a JSON round-trip, as the wire would. Without the
  // mirror fix in sse-schema.ts the parse strips `denominators` and no notice
  // ever shows during a live round. The stream is marked open first: until it
  // is live, the REST ranking (the default fixture, `consistent`) wins over the
  // SSE snapshot, and this helper is about the SSE path.
  async function renderLiveRound(verdict: RoundRanking['denominators']) {
    renderLeaderboard()
    await waitFor(() => expect(screen.getByTestId('leaderboard-loading')).toBeDefined())
    emitStatus('open')
    const wire = JSON.parse(
      JSON.stringify({
        type: 'ranking.updated',
        serverTime: new Date(),
        round: { ...roundRanking, denominators: verdict },
        event: eventRanking,
      }),
    )
    emit(SseEventSchema.parse(wire))
    await waitFor(() => expect(screen.getByTestId('leaderboard-table')).toBeDefined())
  }

  beforeEach(() => {
    setSession(organizer, 'tok-org')
  })

  it('warns the organizer on the Rodada tab when the last closed round is inconsistent', async () => {
    await renderClosedRound('inconsistent')

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-denominators-inconsistent')).toBeDefined(),
    )
    expect(screen.getByTestId('leaderboard-table')).toBeDefined()
  })

  it('warns the organizer while the round is live over SSE', async () => {
    await renderLiveRound('inconsistent')

    expect(screen.getByTestId('leaderboard-denominators-inconsistent')).toBeDefined()
    expect(screen.queryByTestId('leaderboard-denominators-unknown')).toBeNull()
  })

  it('adds nothing when the round is consistent', async () => {
    await renderLiveRound('consistent')

    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
    expect(screen.queryByTestId('leaderboard-denominators-unknown')).toBeNull()
  })

  it('shows only the discreet note when the round is unknown', async () => {
    await renderClosedRound('unknown')

    await waitFor(() =>
      expect(screen.getByTestId('leaderboard-denominators-unknown')).toBeDefined(),
    )
    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
  })

  it('shows nothing to a participant, even when the round is inconsistent', async () => {
    setSession(participant, 'tok-1')
    await renderLiveRound('inconsistent')

    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
    expect(screen.queryByTestId('leaderboard-denominators-unknown')).toBeNull()
  })

  it('keeps the Geral tab free of the notice', async () => {
    await renderLiveRound('inconsistent')
    expect(screen.getByTestId('leaderboard-denominators-inconsistent')).toBeDefined()

    fireEvent.mouseDown(screen.getByTestId('leaderboard-tab-event'))

    await waitFor(() => expect(screen.getByTestId('leaderboard-column-round-r1')).toBeDefined())
    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
  })
})
