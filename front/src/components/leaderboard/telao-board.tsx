import { Minimize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RoundCountdown } from '@/components/round-countdown'
import { type University, UniversityBadge } from '@/components/teams/university-badge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useRankChangeHighlight } from '@/hooks/use-rank-change-highlight'
import { formatTime } from '@/i18n/format'
import { setPresentationActive } from '@/lib/presentation-mode'
import { positionLabel } from '@/lib/round-position'
import type { EventRanking, RoundRanking } from '@/lib/sse-schema'
import { displayTeamName } from '@/lib/team-name'
import { applyTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const PAGE_INTERVAL_MS = 15_000
const ROW_TRANSITION = { layout: { duration: 0.4, ease: 'easeInOut' } } as const

export type TelaoRoundSummary = {
  id: string
  name: string
  closedAt: Date | string | null
}

type TelaoRow = {
  teamId: string
  teamName: string
  rank: number
  totalScore: number
}

type TelaoColumn<T> = {
  id: string
  testId: string
  header: string
  headerTitle?: string
  cell: (row: T) => React.ReactNode
}

function rankColorClass(rank: number): string {
  if (rank === 1) return 'text-brand-text'
  if (rank <= 3) return 'text-foreground'
  return 'text-muted-foreground'
}

export function TelaoBoard({
  hasActiveRound,
  activeRoundId,
  displayedRound,
  eventRanking,
  lastClosedRound,
  closesAt,
  serverTimeOffsetMs,
  myTeamId,
  teamsById,
  problemTitles,
  locale,
  onExit,
}: {
  hasActiveRound: boolean
  activeRoundId: string | null
  displayedRound: RoundRanking | null
  eventRanking: EventRanking | null
  lastClosedRound: TelaoRoundSummary | null
  closesAt: Date | null
  serverTimeOffsetMs: number
  myTeamId: string | null
  teamsById: Map<string, { members: { university: University }[] }>
  problemTitles: Map<string, string | undefined>
  locale: string
  onExit: () => void
}) {
  const { t } = useTranslation()
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)

  // Telão-active signal (hides header/footer regardless of whether real
  // fullscreen ever engaged) + forced dark, independent of the user's actual
  // theme choice — never through `setTheme`, which would persist it. Focus
  // opens on the exit button; the trigger gets it back through leaderboard.tsx's
  // own effect once this unmounts and the toggle re-renders.
  useEffect(() => {
    setPresentationActive(true)
    document.documentElement.classList.add('dark')
    exitButtonRef.current?.focus()
    return () => {
      setPresentationActive(false)
      applyTheme()
    }
  }, [])

  // Two independent exits, each covering what the other misses (#220
  // acceptance): `fullscreenchange` fires when the browser itself leaves
  // fullscreen (Esc consumed by the browser, F11, a system gesture) but
  // never fires at all without a real `requestFullscreen` — that fallback
  // path is exactly what the `keydown` listener below catches instead.
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) onExit()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onExit()
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onExit])

  // The three states (#220 spec item 5). `justClosedRoundId` is scoped to
  // this telão session on purpose: it is only set by observing the
  // open->closed transition live, while mounted, via `activeRoundId` — a
  // fresh mount (telão reopened, or with no round ever having closed while
  // it was up) always starts at `null` and falls through to (b) Geral.
  const [justClosedRoundId, setJustClosedRoundId] = useState<string | null>(null)
  const previousActiveRoundIdRef = useRef(activeRoundId)
  useEffect(() => {
    const previous = previousActiveRoundIdRef.current
    if (previous !== null && activeRoundId === null) {
      setJustClosedRoundId(previous)
    } else if (activeRoundId !== null) {
      setJustClosedRoundId(null)
    }
    previousActiveRoundIdRef.current = activeRoundId
  }, [activeRoundId])

  const showJustClosed =
    !hasActiveRound && justClosedRoundId !== null && lastClosedRound?.id === justClosedRoundId
  const isRoundScoped = hasActiveRound || showJustClosed

  const roundColumns: TelaoColumn<TelaoRow>[] = displayedRound
    ? displayedRound.problemIds.map(
        (problemId, index): TelaoColumn<TelaoRow> => ({
          id: `problem-${problemId}`,
          testId: `leaderboard-column-problem-${problemId}`,
          header: positionLabel(index),
          cell: (row) => {
            const team = displayedRound.teams.find((t) => t.teamId === row.teamId)
            const entry = team?.problems.find((problem) => problem.problemId === problemId)
            return entry ? entry.score : t('leaderboard.noSubmission')
          },
        }),
      )
    : []

  const eventColumns: TelaoColumn<TelaoRow>[] = (eventRanking?.teams[0]?.rounds ?? []).map(
    (round): TelaoColumn<TelaoRow> => ({
      id: `round-${round.roundId}`,
      testId: `leaderboard-column-round-${round.roundId}`,
      header: round.roundName,
      cell: (row) => {
        const team = eventRanking?.teams.find((t) => t.teamId === row.teamId)
        const entry = team?.rounds.find((r) => r.roundId === round.roundId)
        return entry ? entry.score : t('leaderboard.noSubmission')
      },
    }),
  )

  const rows: TelaoRow[] = isRoundScoped
    ? (displayedRound?.teams ?? [])
    : (eventRanking?.teams ?? [])
  const columns = isRoundScoped ? roundColumns : eventColumns

  const highlighted = useRankChangeHighlight(rows)

  // Constant density (#220 spec item 6): measures how many *whole* rows fit
  // the available height instead of shrinking type to cram more teams in —
  // jsdom has no layout engine (no ResizeObserver-driven size, no real
  // getBoundingClientRect), so this path is exercised by the Playwright
  // evidence, not the unit tests, same convention as blockly-workspace.tsx.
  const containerRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLTableSectionElement>(null)
  const firstRowRef = useRef<HTMLTableRowElement>(null)
  const [availableHeight, setAvailableHeight] = useState(0)
  const [rowHeight, setRowHeight] = useState(0)
  const [headHeight, setHeadHeight] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setAvailableHeight(entry.contentRect.height)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Re-measured whenever either height can have changed, never once on
  // mount: the telao is up for the whole event, so it routinely mounts with
  // an empty ranking (a round that just opened, an event with no scores yet)
  // and only grows rows later — a measure-once effect left `rowHeight` at 0
  // forever in that case. The `<thead>` sits inside the measured container
  // and is tall enough to matter (its labels wrap), so the rows only get
  // what is left below it. Over-counting either way does not scroll, it
  // silently clips the last row against the container's `overflow-hidden` —
  // exactly what #220 forbids ("nenhuma linha cortada na borda inferior").
  useEffect(() => {
    const measuredRow = firstRowRef.current?.getBoundingClientRect().height ?? 0
    const measuredHead = headRef.current?.getBoundingClientRect().height ?? 0
    setRowHeight((current) => (measuredRow > 0 ? measuredRow : current))
    setHeadHeight((current) => (measuredHead > 0 ? measuredHead : current))
  }, [rows.length, columns.length, availableHeight])

  // Only "nothing measured yet" falls back to rendering every row. Once the
  // heights are known the count is always clamped to at least one row per
  // page, header included — a header so tall it leaves no body (a projector
  // squeezed to a laptop window, say) must still page through the ranking
  // rather than drop every row into a container that cannot hold them.
  const hasMeasurements = rowHeight > 0 && availableHeight > 0
  const rowsPerPage = hasMeasurements
    ? Math.max(1, Math.floor((availableHeight - headHeight) / rowHeight))
    : rows.length || 1
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const paginated = rows.length > rowsPerPage
  const safePage = Math.min(currentPage, totalPages - 1)

  useEffect(() => {
    if (!paginated) return
    const interval = setInterval(() => {
      setCurrentPage((page) => (page + 1) % totalPages)
    }, PAGE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [paginated, totalPages])

  const visibleRows = paginated
    ? rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage)
    : rows

  return (
    // `min-h-0` is what makes any of the height math below mean anything: a
    // flex item defaults to `min-height: auto`, so without it this board
    // refuses to shrink under its own content, grows past the screen and
    // reports that overgrown height to the ResizeObserver — `rowsPerPage`
    // then always came out equal to the row count, pagination never fired in
    // any state, and the surplus rows were simply cut off by the viewport.
    <div
      data-testid="telao-board"
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden bg-background p-8 text-foreground"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display font-bold text-[84px] leading-none">
          {t('leaderboard.heading')}
        </h1>
        <button
          ref={exitButtonRef}
          type="button"
          data-testid="leaderboard-presentation-toggle"
          aria-pressed={true}
          aria-label={t('leaderboard.telao.exitButton')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
          onClick={onExit}
        >
          <Minimize2 className="size-6" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        {hasActiveRound && displayedRound && (
          <>
            <div className="flex items-center gap-3" data-testid="telao-live-chip">
              <span
                aria-hidden="true"
                className={cn(
                  'size-3 shrink-0 rounded-full bg-brand-text',
                  !prefersReducedMotion && 'animate-pulse',
                )}
              />
              <span className="font-display font-semibold text-2xl text-brand-text uppercase tracking-[0.12em]">
                {t('leaderboard.telao.liveChip', { name: displayedRound.roundName })}
              </span>
            </div>
            {closesAt && (
              <RoundCountdown
                closesAt={closesAt}
                serverTimeOffsetMs={serverTimeOffsetMs}
                roundName={displayedRound.roundName}
                bare
                className="font-display text-[96px] text-brand-text leading-none tabular-nums"
              />
            )}
          </>
        )}

        {!hasActiveRound && showJustClosed && lastClosedRound && (
          <>
            <span
              data-testid="telao-closed-chip"
              className="font-display font-semibold text-2xl text-muted-foreground uppercase tracking-[0.12em]"
            >
              {t('leaderboard.telao.closedChip', { name: lastClosedRound.name })}
            </span>
            {lastClosedRound.closedAt && (
              <span
                data-testid="telao-closed-at"
                className="font-display text-3xl text-muted-foreground tabular-nums"
              >
                {t('leaderboard.telao.closedAt', {
                  time: formatTime(new Date(lastClosedRound.closedAt), locale),
                })}
              </span>
            )}
          </>
        )}

        {!hasActiveRound && !showJustClosed && (
          <>
            <Badge variant="brand" data-testid="telao-general-badge" className="text-lg">
              {t('leaderboard.telao.generalBadge')}
            </Badge>
            <span
              data-testid="telao-waiting-eyebrow"
              className="font-display text-2xl text-muted-foreground uppercase tracking-[0.12em]"
            >
              {t('leaderboard.telao.waitingNextRound')}
            </span>
          </>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden">
        <table className="w-full table-fixed text-[28px]">
          <thead ref={headRef}>
            <tr className="border-b">
              <th className="w-20 px-2 py-2 text-left align-top">
                {t('leaderboard.columns.rank')}
              </th>
              <th className="px-2 py-2 text-left align-top">{t('leaderboard.columns.team')}</th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  data-testid={column.testId}
                  title={column.headerTitle}
                  className="w-28 overflow-hidden px-2 py-2 text-left align-top break-words"
                >
                  {column.header}
                </th>
              ))}
              <th className="w-28 px-2 py-2 text-left align-top">
                {t('leaderboard.columns.total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const isMyTeam = row.teamId === myTeamId
              const isHighlighted = highlighted.has(row.teamId)
              return (
                <motion.tr
                  key={row.teamId}
                  ref={index === 0 ? firstRowRef : undefined}
                  layout={!prefersReducedMotion}
                  transition={!prefersReducedMotion ? ROW_TRANSITION : undefined}
                  data-testid={`leaderboard-row-${row.teamId}`}
                  className={cn(
                    'border-b',
                    isMyTeam && 'bg-brand-soft',
                    // The transition rides the *un*highlighted state on
                    // purpose: a row lights up the instant its rank moves and
                    // the colour bleeds back out over ~3s ("realcada por ~3s,
                    // esvaindo"). Declaring it alongside `bg-brand-soft`
                    // instead would animate the after-change style and invert
                    // the whole thing — a 3s fade *in*, then a hard cut.
                    isHighlighted
                      ? 'bg-brand-soft'
                      : !prefersReducedMotion && 'transition-colors duration-3000',
                  )}
                >
                  <td
                    className={cn(
                      'px-2 py-2 align-top font-display tabular-nums',
                      rankColorClass(row.rank),
                    )}
                  >
                    {row.rank}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate">
                        {displayTeamName(row.teamName, t('teams.unnamed'))}
                      </span>
                      {isMyTeam && (
                        <Badge
                          variant="brand"
                          data-testid="leaderboard-your-team-badge"
                          className="shrink-0"
                        >
                          {t('teams.yourTeamBadge')}
                        </Badge>
                      )}
                      {[
                        ...new Set(
                          (teamsById.get(row.teamId)?.members ?? []).map((m) => m.university),
                        ),
                      ].map((university) => (
                        <UniversityBadge key={university} university={university} />
                      ))}
                    </div>
                  </td>
                  {columns.map((column) => (
                    <td key={column.id} className="px-2 py-2 align-top">
                      {column.cell(row)}
                    </td>
                  ))}
                  <td className="px-2 py-2 align-top font-bold tabular-nums">{row.totalScore}</td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-lg text-muted-foreground">
        {isRoundScoped && displayedRound && displayedRound.problemIds.length > 0 && (
          <ul data-testid="telao-legend" className="flex min-w-0 flex-wrap gap-x-8 gap-y-1">
            {displayedRound.problemIds.map((problemId, index) => (
              <li key={problemId} data-testid={`telao-legend-item-${problemId}`}>
                {t('leaderboard.legend.entry', {
                  letter: positionLabel(index),
                  title: problemTitles.get(problemId) ?? t('leaderboard.legend.loading'),
                })}
              </li>
            ))}
          </ul>
        )}
        {paginated && (
          <span data-testid="telao-page-indicator">
            {t('leaderboard.telao.pageIndicator', { current: safePage + 1, total: totalPages })}
          </span>
        )}
        <span data-testid="telao-exit-hint" className="shrink-0">
          {t('leaderboard.telao.exitHint')}
        </span>
      </div>
    </div>
  )
}
