import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    organizer: {
      stats: { $get: vi.fn(), live: { $get: vi.fn() } },
      'event-config': { $get: vi.fn(), $patch: vi.fn() },
    },
    rounds: { ':id': { ranking: { $get: vi.fn() } } },
  },
}))

// The overview subscribes to /sse. The stream's own parsing is covered by
// use-event-stream.test.ts; captured here so a test can push an event
// through the screen's callbacks without opening a real EventSource.
const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedStatsGet = vi.mocked(api.organizer.stats.$get)
const mockedLiveStatsGet = vi.mocked(api.organizer.stats.live.$get)
const mockedRankingGet = vi.mocked(api.rounds[':id'].ranking.$get)
const mockedConfigPatch = vi.mocked(api.organizer['event-config'].$patch)
const sseUnsubscribe = vi.fn()

function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

const organizerUser: SessionUser = {
  id: 'u1',
  email: 'org@edu.pucrs.br',
  name: 'Org',
  role: 'organizer',
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

function roundRef(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'open',
    openedAt: '2026-09-02T12:00:00.000Z',
    closesAt: '2026-09-02T12:30:00.000Z',
    closedAt: null,
    ...overrides,
  }
}

function stats(overrides: Record<string, unknown> = {}) {
  return {
    participants: { total: 40, pucrs: 25, merida: 15, inTeam: 30, withoutTeam: 10 },
    teams: { total: 8, openSlots: 6, maxTeamSize: 4 },
    submissions: { total: 120, inRound: 17 },
    round: { active: null, lastClosed: null },
    ...overrides,
  }
}

function rankingTeam(overrides: Record<string, unknown> = {}) {
  return {
    teamId: 't1',
    teamName: 'Blockly Busters',
    rank: 1,
    totalScore: 300,
    totalAttempts: 4,
    tiebreakTimeMs: 1000,
    problems: [],
    ...overrides,
  }
}

function renderScreen() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/organizer'] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedStatsGet.mockReset()
  mockedLiveStatsGet.mockReset()
  mockedLiveStatsGet.mockResolvedValue(
    jsonResponse(200, {
      judge: { inFlight: 1, waiting: 0, concurrency: 4 },
      sse: { connections: 4 },
      submissions: { inFlight: 0, lastMinute: 2, perMinute: [...Array(14).fill(0), 2] },
    }),
  )
  mockedRankingGet.mockReset()
  mockedConfigPatch.mockReset()
  connectEventStream.mockReset()
  sseUnsubscribe.mockReset()
  connectEventStream.mockReturnValue(sseUnsubscribe)
  setSession(organizerUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('organizer overview', () => {
  // #285: the pause shortcut. The card reads the flag from the SSE stream —
  // the organizer's own PATCH comes back to them as submissions.paused/resumed.
  describe('submissions pause shortcut', () => {
    function syncPaused(submissionsPaused: boolean, round: { id: string } | null) {
      emitSse({
        type: 'state.sync',
        serverTime: new Date(),
        round: round ? { id: round.id, closesAt: new Date(Date.now() + 60_000) } : null,
        submissionsPaused,
      })
    }

    it('offers Pause while a round runs and PATCHes the flag on', async () => {
      mockedStatsGet.mockResolvedValue(
        jsonResponse(200, stats({ round: { active: roundRef(), lastClosed: null } })),
      )
      mockedConfigPatch.mockResolvedValue(jsonResponse(200, {}))
      renderScreen()

      const toggle = await screen.findByTestId('overview-round-pause-toggle')
      syncPaused(false, { id: 'r1' })
      expect(toggle.textContent).toContain('Pausar submissões')
      expect(screen.queryByTestId('overview-submissions-paused-badge')).toBeNull()

      act(() => toggle.click())

      await waitFor(() =>
        expect(mockedConfigPatch).toHaveBeenCalledWith({ json: { submissionsPaused: true } }),
      )
    })

    it('shows the badge and Resume while paused, and PATCHes the flag off', async () => {
      mockedStatsGet.mockResolvedValue(
        jsonResponse(200, stats({ round: { active: roundRef(), lastClosed: null } })),
      )
      mockedConfigPatch.mockResolvedValue(jsonResponse(200, {}))
      renderScreen()

      const toggle = await screen.findByTestId('overview-round-pause-toggle')
      syncPaused(true, { id: 'r1' })

      expect(screen.getByTestId('overview-submissions-paused-badge').textContent).toContain(
        'Submissões pausadas',
      )
      expect(toggle.textContent).toContain('Retomar submissões')

      act(() => toggle.click())
      await waitFor(() =>
        expect(mockedConfigPatch).toHaveBeenCalledWith({ json: { submissionsPaused: false } }),
      )

      emitSse({ type: 'submissions.resumed', serverTime: new Date() })
      expect(screen.queryByTestId('overview-submissions-paused-badge')).toBeNull()
    })

    it('keeps the badge but drops the button when no round is open', async () => {
      mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))
      renderScreen()

      await screen.findByTestId('overview-round-none')
      syncPaused(true, null)

      expect(screen.getByTestId('overview-submissions-paused-badge')).toBeDefined()
      expect(screen.queryByTestId('overview-round-pause-toggle')).toBeNull()
    })

    it('shows an error when the toggle fails', async () => {
      mockedStatsGet.mockResolvedValue(
        jsonResponse(200, stats({ round: { active: roundRef(), lastClosed: null } })),
      )
      mockedConfigPatch.mockResolvedValue(jsonResponse(500, { error: 'internal' }))
      renderScreen()

      const toggle = await screen.findByTestId('overview-round-pause-toggle')
      act(() => toggle.click())

      expect((await screen.findByTestId('overview-round-pause-error')).textContent).toContain(
        'Não foi possível alterar a pausa',
      )
    })
  })

  it('shows signups per university, teams and submissions', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-signups-total').textContent).toContain('40'),
    )
    expect(screen.getByTestId('overview-signups-pucrs').textContent).toContain('25')
    expect(screen.getByTestId('overview-signups-merida').textContent).toContain('15')
    expect(screen.getByTestId('overview-teams-total').textContent).toContain('8')
    expect(screen.getByTestId('overview-teams-members').textContent).toContain('30')
    expect(screen.getByTestId('overview-teams-slots').textContent).toContain('6')
    expect(screen.getByTestId('overview-teams-without-team').textContent).toContain('10')
    expect(screen.getByTestId('overview-submissions-total').textContent).toContain('120')
  })

  it('shows the timer and this round´s submissions while a round is open', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 17 },
          round: { active: roundRef(), lastClosed: null },
        }),
      ),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-round-name').textContent).toContain('Rodada 1'),
    )
    // Scoped to the round card: the header (#217) renders its own
    // `round-countdown` chip whenever a round is open, so the bare testid
    // matches two elements once both are mounted.
    expect(
      within(screen.getByTestId('overview-round-card')).getByTestId('round-countdown'),
    ).toBeDefined()
    expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
      '17 nesta rodada',
    )
    // A live ranking mid-round would be a spoiler — and nothing was fetched.
    expect(screen.queryByTestId('overview-round-podium')).toBeNull()
    expect(mockedRankingGet).not.toHaveBeenCalled()
  })

  // The "ao vivo" half of the open-round criterion: a judged submission is
  // announced as ranking.updated (#44), and the screen answers it by
  // refetching its own numbers — no reload, no new SSE event type.
  it('refetches this round´s submissions live when ranking.updated arrives', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 17 },
          round: { active: roundRef(), lastClosed: null },
        }),
      ),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
        '17 nesta rodada',
      ),
    )
    await waitFor(() => expect(connectEventStream).toHaveBeenCalledTimes(1))

    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 121, inRound: 18 },
          round: { active: roundRef(), lastClosed: null },
        }),
      ),
    )
    emitSse({
      type: 'ranking.updated',
      serverTime: new Date('2026-09-02T12:05:00.000Z'),
      round: null,
      event: { teams: [] },
    })

    await waitFor(() =>
      expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
        '18 nesta rodada',
      ),
    )
    expect(screen.getByTestId('overview-submissions-total').textContent).toContain('121')
    expect(mockedStatsGet).toHaveBeenCalledTimes(2)
  })

  it('shows the last closed round with its podium when no round is open', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 9 },
          round: {
            active: null,
            lastClosed: roundRef({
              id: 'r-closed',
              name: 'Rodada 2',
              status: 'closed',
              closedAt: '2026-09-02T13:00:00.000Z',
            }),
          },
        }),
      ),
    )
    mockedRankingGet.mockResolvedValue(
      jsonResponse(200, {
        roundId: 'r-closed',
        roundName: 'Rodada 2',
        problemIds: [],
        // getRoundRanking (#184) already omits a team that never submitted
        // in the round — no "Fantasma" entry to filter out here.
        teams: [
          rankingTeam(),
          rankingTeam({ teamId: 't2', teamName: 'Loop Masters', rank: 2, totalScore: 200 }),
        ],
      }),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-round-name').textContent).toContain('Rodada 2'),
    )
    expect(screen.getByTestId('overview-submissions-in-round').textContent).toContain(
      '9 na última rodada',
    )
    await waitFor(() =>
      expect(screen.getByTestId('overview-round-podium-t1').textContent).toContain(
        'Blockly Busters',
      ),
    )
    expect(screen.getByTestId('overview-round-podium-t2').textContent).toContain('Loop Masters')
    expect(screen.queryByTestId('overview-round-podium-t3')).toBeNull()
    expect(mockedRankingGet).toHaveBeenCalledWith({ param: { id: 'r-closed' } })
  })

  // Achado #10 (#185): the podium is a ranking like any other, so a team
  // stored blank before the fix used to take a podium place with nothing
  // written on it — the organizer's own dashboard, and the one render point
  // the first pass missed.
  it('labels a blank-named team on the podium instead of leaving it nameless', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          submissions: { total: 120, inRound: 9 },
          round: {
            active: null,
            lastClosed: roundRef({
              id: 'r-closed',
              name: 'Rodada 2',
              status: 'closed',
              closedAt: '2026-09-02T13:00:00.000Z',
            }),
          },
        }),
      ),
    )
    mockedRankingGet.mockResolvedValue(
      jsonResponse(200, {
        roundId: 'r-closed',
        roundName: 'Rodada 2',
        problemIds: [],
        teams: [rankingTeam({ teamName: '   ' })],
      }),
    )

    renderScreen()

    await waitFor(() =>
      expect(screen.getByTestId('overview-round-podium-t1').textContent).toContain('Time sem nome'),
    )
  })

  it('offers the four panel shortcuts', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))

    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-shortcuts-card')).toBeDefined())
    expect(screen.getByTestId('overview-shortcuts-problems').getAttribute('href')).toBe(
      '/organizer/problems',
    )
    expect(screen.getByTestId('overview-shortcuts-rounds').getAttribute('href')).toBe(
      '/organizer/rounds',
    )
    expect(screen.getByTestId('overview-shortcuts-teams').getAttribute('href')).toBe(
      '/organizer/teams',
    )
    expect(screen.getByTestId('overview-shortcuts-event-config').getAttribute('href')).toBe(
      '/organizer/event-config',
    )
    expect(screen.getByTestId('overview-shortcuts-users').getAttribute('href')).toBe(
      '/organizer/users',
    )
  })

  // #278: the export lives on the overview and nowhere else. Its own
  // behaviour (which query each item calls, the error state) is covered by
  // components/organizer/export-menu.test.tsx; what belongs here is that the
  // screen carries it, next to the heading.
  it('carries the export menu beside the heading', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))

    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-heading')).toBeDefined())
    const trigger = screen.getByTestId('export-menu-trigger')
    expect(trigger).toBeDefined()
    // Same row as the heading: they share a parent, and nothing was fetched
    // just by rendering the menu.
    expect(trigger.closest('div')?.parentElement).toBe(
      screen.getByTestId('overview-heading').parentElement,
    )
  })

  it('offers a retry when the stats request fails', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-error')).toBeDefined())
    expect(screen.getByTestId('overview-retry')).toBeDefined()
  })

  // #279: the live card has its own query, from process memory. When the
  // event numbers (which need the database) fail, it still answers.
  it('keeps the live card up when the event numbers fail to load', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-error')).toBeDefined())
    await waitFor(() =>
      expect(screen.getByTestId('overview-live-sse-connections').textContent).toBe('4'),
    )
    expect(screen.getByTestId('overview-live-judge-in-flight').textContent).toBe('1')
  })

  it('places the live card between the numeric cards and the shortcuts', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))

    renderScreen()

    const roundCard = await screen.findByTestId('overview-round-card')
    const live = screen.getByTestId('overview-live-card')
    const shortcuts = screen.getByTestId('overview-shortcuts-card')
    expect(roundCard.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(live.compareDocumentPosition(shortcuts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// #223: the overview in the identity — four numeric cards on one row, the
// podium on a card of its own, the shortcuts as a list. Colours and layout
// are measured in the browser (e2e/organizer-identity.spec.ts); what is
// asserted here is the structure and the wiring.
describe('organizer overview — identity (#223)', () => {
  it('sets every headline number in the display face, tabular', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-signups-total')).toBeDefined())
    for (const testId of [
      'overview-signups-total',
      'overview-teams-total',
      'overview-submissions-total',
    ]) {
      const stat = screen.getByTestId(testId)
      expect(stat.className).toContain('font-display')
      expect(stat.className).toContain('tabular-nums')
    }
  })

  it('marks the round card with the brand border and the open chip while a round runs', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(200, stats({ round: { active: roundRef(), lastClosed: null } })),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-round-card')).toBeDefined())
    // The only card the identity lets carry the brand border, and only while
    // something is actually happening.
    expect(screen.getByTestId('overview-round-card').className).toContain('border-brand')
    expect(screen.getByTestId('overview-round-open-state').className).toContain('text-brand-text')
    expect(
      within(screen.getByTestId('overview-round-card')).getByTestId('round-countdown').className,
    ).toContain('text-brand-text')
    // No closed round yet, so no podium card at all.
    expect(screen.queryByTestId('overview-podium-card')).toBeNull()
  })

  it('leaves the round card unbranded when no round is open', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-round-card')).toBeDefined())
    expect(screen.getByTestId('overview-round-card').className).not.toContain('border-brand')
    expect(screen.queryByTestId('overview-round-open-state')).toBeNull()
    // Neither round at all: the existing empty state, unchanged.
    expect(screen.getByTestId('overview-round-none')).toBeDefined()
    expect(screen.queryByTestId('overview-round-cta')).toBeNull()
  })

  it('gives the two round CTAs names of their own', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(200, stats({ round: { active: roundRef(), lastClosed: null } })),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-round-cta')).toBeDefined())
    // Until #223 both shared `overview-round-cta`, because only one of them
    // was ever on screen at a time.
    expect(screen.getByTestId('overview-round-cta').getAttribute('href')).toBe('/organizer/rounds')
    expect(screen.getByTestId('overview-round-leaderboard-cta').getAttribute('href')).toBe(
      '/leaderboard',
    )
  })

  it('puts the closed round podium on a card of its own, the winner in brand', async () => {
    mockedStatsGet.mockResolvedValue(
      jsonResponse(
        200,
        stats({
          round: {
            active: null,
            lastClosed: roundRef({
              id: 'r-closed',
              name: 'Rodada 2',
              status: 'closed',
              closedAt: '2026-09-02T13:00:00.000Z',
            }),
          },
        }),
      ),
    )
    mockedRankingGet.mockResolvedValue(
      jsonResponse(200, {
        roundId: 'r-closed',
        roundName: 'Rodada 2',
        problemIds: [],
        teams: [
          rankingTeam(),
          rankingTeam({ teamId: 't2', teamName: 'Loop Masters', rank: 2, totalScore: 200 }),
        ],
      }),
    )
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-podium-card')).toBeDefined())
    // The closing time moved into the podium card's header along with it.
    expect(
      within(screen.getByTestId('overview-podium-card')).getByTestId('overview-round-closed-at'),
    ).toBeDefined()

    // The ranking is a second query, so the entries land after the card.
    await waitFor(() => expect(screen.getByTestId('overview-round-podium-t1')).toBeDefined())
    const first = screen.getByTestId('overview-round-podium-t1')
    expect(first.textContent).toContain('Blockly Busters')
    expect(first.textContent).toContain('300')
    // The numeral is now a column, not a "#1 name · pts" sentence — and only
    // the winner's takes the brand colour.
    expect(first.firstElementChild?.className).toContain('text-brand-text')
    expect(
      screen.getByTestId('overview-round-podium-t2').firstElementChild?.className,
    ).not.toContain('text-brand-text')
  })

  it('renders the five shortcuts as a list of links, not a row of buttons', async () => {
    mockedStatsGet.mockResolvedValue(jsonResponse(200, stats()))
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('overview-shortcuts-card')).toBeDefined())
    // Five, not the mock's four: the count is the acceptance criterion's, and
    // `overview-shortcuts-teams` is already covered by an existing test.
    const list = within(screen.getByTestId('overview-shortcuts-card')).getByRole('list')
    expect(within(list).getAllByRole('link')).toHaveLength(5)
  })
})
