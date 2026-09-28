import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'

import { isPresentationActive, setPresentationActive } from '@/lib/presentation-mode'
import type { EventRanking, RoundRanking } from '@/lib/sse-schema'
import { setTheme } from '@/lib/theme'

import { TelaoBoard, type TelaoRoundSummary } from './telao-board'

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
  ],
}

const teamsById = new Map<string, { members: { university: 'pucrs' | 'merida' }[] }>([
  ['t1', { members: [{ university: 'pucrs' }] }],
  ['t2', { members: [{ university: 'merida' }] }],
])

function baseProps() {
  return {
    hasActiveRound: false,
    activeRoundId: null as string | null,
    displayedRound: null as RoundRanking | null,
    eventRanking,
    lastClosedRound: null as TelaoRoundSummary | null,
    closesAt: null as Date | null,
    serverTimeOffsetMs: 0,
    myTeamId: null as string | null,
    teamsById,
    problemTitles: new Map<string, string | undefined>([['p1', 'Soma dos pares']]),
    locale: 'pt',
    onExit: vi.fn(),
  }
}

beforeEach(() => {
  document.documentElement.className = ''
  setTheme('system')
})

afterEach(() => {
  cleanup()
  setPresentationActive(false)
  document.documentElement.className = ''
  localStorage.clear()
})

describe('TelaoBoard — mount/unmount (#220 T8)', () => {
  it('activates the presentation signal and forces dark on mount, restoring both on unmount', () => {
    setTheme('light')
    const { unmount } = render(<TelaoBoard {...baseProps()} />)

    expect(isPresentationActive()).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    unmount()

    expect(isPresentationActive()).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('moves focus to the exit button on mount', () => {
    render(<TelaoBoard {...baseProps()} />)

    expect(document.activeElement).toBe(screen.getByTestId('leaderboard-presentation-toggle'))
  })
})

describe('TelaoBoard — dual exit (#220 T8)', () => {
  it('exits on Escape keydown even without a real fullscreen element (API-unsupported fallback)', () => {
    const onExit = vi.fn()
    render(<TelaoBoard {...baseProps()} onExit={onExit} />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('exits on fullscreenchange when the browser leaves fullscreen on its own', () => {
    const onExit = vi.fn()
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.createElement('main'),
    })
    render(<TelaoBoard {...baseProps()} onExit={onExit} />)

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('calls onExit when the exit button is clicked', () => {
    const onExit = vi.fn()
    render(<TelaoBoard {...baseProps()} onExit={onExit} />)

    screen.getByTestId('leaderboard-presentation-toggle').click()

    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('TelaoBoard — three states (#220 T9)', () => {
  it('(a) shows the live chip and countdown with an active round', () => {
    render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={roundRanking}
        closesAt={new Date(Date.now() + 60_000)}
      />,
    )

    expect(screen.getByTestId('telao-live-chip').textContent).toContain('Rodada 1')
    expect(screen.getByTestId('round-countdown')).toBeDefined()
    expect(screen.queryByTestId('telao-general-badge')).toBeNull()
  })

  it('(b) shows the Geral badge and waiting eyebrow with no active round and nothing just closed', () => {
    render(<TelaoBoard {...baseProps()} />)

    expect(screen.getByTestId('telao-general-badge')).toBeDefined()
    expect(screen.getByTestId('telao-waiting-eyebrow')).toBeDefined()
    expect(screen.getByTestId('leaderboard-row-t1')).toBeDefined()
  })

  it('(c) shows the closed chip and time only right after observing the round close live', () => {
    const lastClosedRound: TelaoRoundSummary = {
      id: 'r1',
      name: 'Rodada 1',
      closedAt: new Date('2026-09-05T13:00:00.000Z'),
    }
    const { rerender } = render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={roundRanking}
        closesAt={new Date(Date.now() + 60_000)}
      />,
    )

    // The round closes while telão stays mounted: activeRoundId drops to
    // null and the round's own ranking becomes the "last closed" snapshot —
    // exactly how leaderboard.tsx's `displayedRound` behaves once
    // `hasActiveRound` flips.
    rerender(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound={false}
        activeRoundId={null}
        displayedRound={roundRanking}
        lastClosedRound={lastClosedRound}
      />,
    )

    expect(screen.getByTestId('telao-closed-chip').textContent).toContain('Rodada 1')
    expect(screen.getByTestId('telao-closed-at')).toBeDefined()
  })

  it('never shows (c) on a fresh mount with no active round, even if a round closed in the past', () => {
    const lastClosedRound: TelaoRoundSummary = {
      id: 'r1',
      name: 'Rodada 1',
      closedAt: new Date('2026-09-05T13:00:00.000Z'),
    }
    render(
      <TelaoBoard
        {...baseProps()}
        displayedRound={roundRanking}
        lastClosedRound={lastClosedRound}
      />,
    )

    expect(screen.queryByTestId('telao-closed-chip')).toBeNull()
    expect(screen.getByTestId('telao-general-badge')).toBeDefined()
  })
})

// Stands in for the jsdom shim when a test needs to drive a resize by hand —
// same pattern blockly-workspace.test.tsx uses for the same reason (jsdom
// has no layout engine, so the real ResizeObserver callback never fires).
class RecordingResizeObserver {
  static instances: RecordingResizeObserver[] = []
  readonly disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    RecordingResizeObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
}

function threeTeamRound(): RoundRanking {
  return {
    roundId: 'r1',
    roundName: 'Rodada 1',
    problemIds: ['p1'],
    denominators: 'consistent',
    teams: [
      { ...roundRanking.teams[0]! },
      { ...roundRanking.teams[1]! },
      { ...roundRanking.teams[0]!, teamId: 't3', teamName: 'Time 3', rank: 3 },
    ],
  }
}

describe('TelaoBoard — pagination (#220 T10)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    RecordingResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', RecordingResizeObserver)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 40,
    } as DOMRect)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not paginate when every row fits the measured height', () => {
    render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={roundRanking}
      />,
    )

    const observer = RecordingResizeObserver.instances[0]
    // Every element measures 40px here, the <thead> included, so 120px of
    // container leaves 80px of body: exactly the 2 rows this round has.
    act(() =>
      observer?.callback(
        [{ contentRect: { height: 120 } } as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      ),
    )

    expect(screen.queryByTestId('telao-page-indicator')).toBeNull()
  })

  it('paginates and advances every 15s when there are more rows than fit', () => {
    render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={threeTeamRound()}
      />,
    )

    const observer = RecordingResizeObserver.instances[0]
    // 120px of container minus the 40px header leaves 80px of body: 2 rows
    // per page at 40px each, 3 teams -> 2 pages.
    act(() =>
      observer?.callback(
        [{ contentRect: { height: 120 } } as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      ),
    )

    expect(screen.getByTestId('telao-page-indicator').textContent).toContain('1 / 2')

    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByTestId('telao-page-indicator').textContent).toContain('2 / 2')

    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByTestId('telao-page-indicator').textContent).toContain('1 / 2')
  })

  it('counts only the rows that fit below the header, not the whole container', () => {
    render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={threeTeamRound()}
      />,
    )

    const observer = RecordingResizeObserver.instances[0]
    // 160px of container looks like room for 4 rows of 40px, but the 40px
    // <thead> lives inside it too — only 3 fit, so the third team must not
    // be pushed past the bottom edge (#220: "nenhuma linha cortada").
    act(() =>
      observer?.callback(
        [{ contentRect: { height: 160 } } as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      ),
    )

    expect(screen.queryByTestId('telao-page-indicator')).toBeNull()
    expect(screen.getByTestId('leaderboard-row-t3')).toBeDefined()
  })

  it('keeps the board itself shrinkable so the measured height is the screen, not the content', () => {
    render(<TelaoBoard {...baseProps()} />)

    // Without `min-h-0` the board refuses to shrink below its own content
    // (flex items default to `min-height: auto`), reports that overgrown
    // height to the ResizeObserver, and pagination can never fire — jsdom
    // cannot see the layout, so the class itself is the guard.
    const board = screen.getByTestId('telao-board')
    expect(board.className).toContain('min-h-0')
    expect(board.className).toContain('overflow-hidden')
  })

  it('starts paginating once teams arrive on a telão that mounted with an empty board', () => {
    const emptyRound: RoundRanking = { ...roundRanking, teams: [] }
    const { rerender } = render(
      <TelaoBoard {...baseProps()} hasActiveRound activeRoundId="r1" displayedRound={emptyRound} />,
    )

    const observer = RecordingResizeObserver.instances[0]
    act(() =>
      observer?.callback(
        [{ contentRect: { height: 120 } } as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      ),
    )
    // Nothing to measure a row against yet — and nothing to paginate either.
    expect(screen.queryByTestId('telao-page-indicator')).toBeNull()

    rerender(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={threeTeamRound()}
      />,
    )

    expect(screen.getByTestId('telao-page-indicator').textContent).toContain('1 / 2')
  })
})

describe('TelaoBoard — footer legend (#220 spec 4)', () => {
  it('spells out each problem letter with its title, not the bare letter', () => {
    render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={roundRanking}
      />,
    )

    expect(screen.getByTestId('telao-legend-item-p1').textContent).toBe('A — Soma dos pares')
  })

  it('falls back to the loading placeholder while a title is still in flight', () => {
    render(
      <TelaoBoard
        {...baseProps()}
        problemTitles={new Map<string, string | undefined>()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={roundRanking}
      />,
    )

    expect(screen.getByTestId('telao-legend-item-p1').textContent).toBe('A — carregando…')
  })
})

describe('TelaoBoard — blank team names (#185)', () => {
  // Achado #10: a team stored as "   " before #185 put a nameless row on the
  // telao, next to the named ones and indistinguishable from a rendering bug.
  it('labels a blank-named team instead of leaving the row nameless', () => {
    const blankNamed: RoundRanking = {
      ...roundRanking,
      teams: [{ ...roundRanking.teams[0]!, teamName: '   ' }],
    }

    render(
      <TelaoBoard {...baseProps()} hasActiveRound activeRoundId="r1" displayedRound={blankNamed} />,
    )

    expect(screen.getByTestId('leaderboard-row-t1').textContent).toContain('Time sem nome')
  })
})

describe('TelaoBoard — reduced motion (#220 T11)', () => {
  it('does not pulse the live dot when prefers-reduced-motion is set', async () => {
    const { setMatchMediaMatches } = await import('@/test/match-media-jsdom')
    setMatchMediaMatches('(prefers-reduced-motion: reduce)', true)

    render(
      <TelaoBoard
        {...baseProps()}
        hasActiveRound
        activeRoundId="r1"
        displayedRound={roundRanking}
        closesAt={new Date(Date.now() + 60_000)}
      />,
    )

    const dot = screen.getByTestId('telao-live-chip').querySelector('[aria-hidden="true"]')
    expect(dot?.className).not.toContain('animate-pulse')

    setMatchMediaMatches('(prefers-reduced-motion: reduce)', false)
  })
})
