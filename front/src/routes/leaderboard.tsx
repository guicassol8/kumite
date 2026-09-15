import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Maximize2, TriangleAlert, WifiOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TelaoBoard } from '@/components/leaderboard/telao-board'
import { RoundCountdown } from '@/components/round-countdown'
import { type University, UniversityBadge } from '@/components/teams/university-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLeaderboardStream } from '@/hooks/use-leaderboard-stream'
import { api } from '@/lib/api'
import { fetchEventRanking, fetchRoundRanking } from '@/lib/ranking-query'
import { positionLabel } from '@/lib/round-position'
import { fetchRounds, ROUNDS_QUERY_KEY } from '@/lib/rounds-query'
import { requireAuth } from '@/lib/route-guards'
import type { EventRankingTeam, RoundRanking, RoundRankingTeam } from '@/lib/sse-schema'
import { fetchTeams, TEAMS_QUERY_KEY } from '@/lib/teams-query'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/leaderboard')({
  beforeLoad: requireAuth,
  component: LeaderboardScreen,
})

function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

const ROW_TRANSITION = { layout: { duration: 0.4, ease: 'easeInOut' } } as const

// With the stream down the REST queries below become the only source of
// fresh data, so they poll on this interval until it comes back. Polling
// `rounds` is what makes a round opening or closing show up at all without
// SSE — every other fallback hangs off which round is active.
export const POLL_WHILE_OFFLINE_MS = 15_000

// Table row classes mirror ui/table.tsx's TableRow — needed here because the
// position-change animation (#45 plan) requires `motion.tr`, not the plain
// `<tr>` that component renders. Stacks into a card below `md`
// (`size.breakpoint-cards`, 768px) and becomes a real table row from there —
// same single-DOM-tree trick as `rounds.$id.tsx`'s problem list, with
// explicit ARIA roles kept alongside the table tags since the CSS display
// override below `md` breaks their implicit ones.
const ROW_CLASSNAME =
  'flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted md:table-row md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:p-0'

function rankColorClass(rank: number): string {
  if (rank === 1) return 'text-brand-text'
  if (rank <= 3) return 'text-foreground'
  return 'text-muted-foreground'
}

function universitiesForTeam(
  teamId: string,
  teamsById: Map<string, { members: { university: University }[] }>,
): University[] {
  const team = teamsById.get(teamId)
  if (!team) return []
  return [...new Set(team.members.map((member) => member.university))]
}

type RankingColumn<T> = {
  id: string
  testId: string
  header: React.ReactNode
  headerTitle?: string
  mobileLabel: string
  cell: (row: T) => React.ReactNode
}

// One generic table for both the Rodada and Geral tabs (#220): the only
// difference between them is which extra columns sit between "team" and
// "total" — round problems as letters here, round names on the Geral tab.
function RankingTable<
  T extends { teamId: string; teamName: string; rank: number; totalScore: number },
>({
  columns,
  rows,
  myTeamId,
}: {
  columns: RankingColumn<T>[]
  rows: T[]
  myTeamId: string | null
}) {
  return (
    <table data-testid="leaderboard-table" role="table" className="w-full table-fixed text-sm">
      <thead className="hidden md:table-header-group">
        <tr role="row" className="border-b">
          {columns.map((column) => (
            <th
              key={column.id}
              role="columnheader"
              data-testid={column.testId}
              title={column.headerTitle}
              className={cn(
                'h-10 px-2 text-left align-middle font-medium text-foreground',
                column.id === 'team' && 'md:sticky md:left-0 md:z-10 md:bg-background',
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isMyTeam = row.teamId === myTeamId
          return (
            <motion.tr
              key={row.teamId}
              layout
              transition={ROW_TRANSITION}
              role="row"
              data-testid={`leaderboard-row-${row.teamId}`}
              className={cn(ROW_CLASSNAME, isMyTeam && 'bg-brand-soft md:bg-brand-soft')}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  role="cell"
                  className={cn(
                    'flex items-center justify-between gap-2 md:table-cell md:p-2 md:align-middle',
                    column.id === 'team' &&
                      cn(
                        'md:sticky md:left-0 md:z-10',
                        isMyTeam ? 'md:bg-brand-soft' : 'md:bg-background',
                      ),
                  )}
                >
                  <span className="sr-only md:hidden">{column.mobileLabel}: </span>
                  {column.cell(row)}
                </td>
              ))}
            </motion.tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LeaderboardScreen() {
  const { t, i18n } = useTranslation()
  const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)
  const queryClient = useQueryClient()
  const mainRef = useRef<HTMLElement>(null)
  const [isPresentation, setIsPresentation] = useState(false)

  // Exiting is TelaoBoard's job from here (it owns the fullscreenchange and
  // Escape-keydown listeners while mounted) — this effect only hands focus
  // back to the toggle that opened it, and only on a genuine close, never on
  // first mount (`wasPresentingRef` starts false).
  const wasPresentingRef = useRef(false)
  useEffect(() => {
    if (wasPresentingRef.current && !isPresentation) {
      document
        .querySelector<HTMLButtonElement>('[data-testid="leaderboard-presentation-toggle"]')
        ?.focus()
    }
    wasPresentingRef.current = isPresentation
  }, [isPresentation])

  const enterPresentation = useCallback(() => {
    // Set optimistically: if the Fullscreen API is unsupported or the
    // request is denied, the enlarged layout still applies (degrade
    // gracefully) — TelaoBoard's own fullscreenchange listener confirms the
    // same state later if a real transition does happen.
    setIsPresentation(true)
    mainRef.current?.requestFullscreen().catch(() => {})
  }, [])

  const exitPresentation = useCallback(() => {
    setIsPresentation(false)
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])
  // round.opened/round.closed refetch the list so a round that just closed
  // (or opened) resolves in `closedRounds`/`lastClosedRound` right away,
  // instead of staying stuck on the stale snapshot until something else
  // happens to refetch it — same pattern as index.tsx's invalidateRounds.
  const invalidateRounds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ROUNDS_QUERY_KEY })
  }, [queryClient])
  const stream = useLeaderboardStream(invalidateRounds)

  const refetchInterval = stream.isLive ? false : POLL_WHILE_OFFLINE_MS

  const teams = useQuery({ queryKey: TEAMS_QUERY_KEY, queryFn: fetchTeams })
  const rounds = useQuery({ queryKey: ROUNDS_QUERY_KEY, queryFn: fetchRounds, refetchInterval })

  // `stream.activeRoundId` used to be the only source of "a round is open",
  // so a dead stream made an open round invisible and the "Rodada" tab fell
  // back to the last *closed* round — the wrong round on the venue's screen
  // (#180). GET /rounds already reports the open one (and reaps expired
  // rounds on the way), so it covers the gap with no backend change.
  const restOpenRound = (rounds.data ?? []).find((round) => round.status === 'open') ?? null
  const activeRoundId = stream.activeRoundId ?? restOpenRound?.id ?? null
  const hasActiveRound = activeRoundId !== null
  const serverTimeOffsetMs = stream.serverTime ? stream.serverTime.getTime() - Date.now() : 0
  const closedRounds = (rounds.data ?? [])
    .filter((round) => round.status === 'closed' && round.closedAt)
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
  const lastClosedRound = closedRounds[0] ?? null

  const lastClosedRanking = useQuery({
    queryKey: ['ranking', 'round', lastClosedRound?.id],
    queryFn: () => fetchRoundRanking(lastClosedRound!.id),
    enabled: !hasActiveRound && lastClosedRound !== null,
    refetchInterval,
  })

  // `ranking.updated` only re-publishes on a submission-driven dirty tick
  // (#44) — a round that opens with zero submissions never arrives via SSE
  // on its own, so fetch it once over REST as soon as `activeRoundId` shows
  // up. A later `ranking.updated` for this round overrides it (see below).
  // Same query key as the SSE path uses, so the two share one cache entry
  // instead of duplicating the round's ranking.
  const activeRoundRanking = useQuery({
    queryKey: ['ranking', 'round', activeRoundId],
    queryFn: () => fetchRoundRanking(activeRoundId!),
    enabled: hasActiveRound && (stream.round === null || !stream.isLive),
    refetchInterval,
  })

  const eventRankingRest = useQuery({
    queryKey: ['ranking', 'event'],
    queryFn: fetchEventRanking,
    enabled: stream.event === null || !stream.isLive,
    refetchInterval,
  })

  // Precedence flips with the connection: while the stream is live its
  // payload is the freshest thing there is, and REST only fills the gaps;
  // once it is down the poll is the newer source and the frozen SSE snapshot
  // becomes the fallback. The trailing `??` is what satisfies acceptance #5 —
  // a stream that dies before the first REST answer keeps its last ranking on
  // screen instead of dropping back to loading.
  const displayedRound: RoundRanking | null = hasActiveRound
    ? stream.isLive
      ? (stream.round ?? activeRoundRanking.data ?? null)
      : (activeRoundRanking.data ?? stream.round ?? null)
    : (lastClosedRanking.data ?? null)
  const isLastClosedRound = !hasActiveRound && displayedRound !== null
  // `rounds.data` comes straight off `.json()` with no zod parse, so its date
  // fields are ISO strings at runtime despite the `Date` type — same caveat
  // index.tsx already carries. Without SSE there is no `serverTime` either,
  // so the countdown runs on an offset of 0.
  const countdownClosesAt =
    stream.closesAt ?? (restOpenRound?.closesAt ? new Date(restOpenRound.closesAt) : null)
  const eventRanking = stream.isLive
    ? (stream.event ?? eventRankingRest.data ?? null)
    : (eventRankingRest.data ?? stream.event ?? null)

  const problemIds = displayedRound?.problemIds ?? []
  const problemQueries = useQueries({
    queries: problemIds.map((problemId) => ({
      queryKey: ['problem-title', problemId, locale],
      queryFn: async () => {
        const res = await api.problems[':id'].$get({ param: { id: problemId }, query: { locale } })
        if (!res.ok) throw new Error('failed to load problem')
        return res.json()
      },
    })),
  })
  // No fallback here on purpose: the header shows the letter regardless
  // (positionLabel), and the legend below has its own loading placeholder —
  // unlike the old `problemFallback` copy, nothing here depends on the
  // title having loaded yet.
  const problemTitleById = new Map(
    problemIds.map((problemId, index) => [problemId, problemQueries[index]?.data?.title]),
  )

  const teamsById = new Map((teams.data?.teams ?? []).map((team) => [team.id, team]))
  const myTeamId = teams.data?.myTeamId ?? null

  function teamColumn<T extends { teamId: string; teamName: string }>(): RankingColumn<T> {
    return {
      id: 'team',
      testId: 'leaderboard-column-team',
      header: t('leaderboard.columns.team'),
      mobileLabel: t('leaderboard.columns.team'),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.teamName}</span>
          {row.teamId === myTeamId && (
            <Badge variant="brand" data-testid="leaderboard-your-team-badge">
              {t('teams.yourTeamBadge')}
            </Badge>
          )}
          {universitiesForTeam(row.teamId, teamsById).map((university) => (
            <UniversityBadge key={university} university={university} />
          ))}
        </div>
      ),
    }
  }

  function rankColumn<T extends { rank: number }>(): RankingColumn<T> {
    return {
      id: 'rank',
      testId: 'leaderboard-column-rank',
      header: t('leaderboard.columns.rank'),
      mobileLabel: t('leaderboard.columns.rank'),
      cell: (row) => (
        <span className={cn('font-display tabular-nums', rankColorClass(row.rank))}>
          {row.rank}
        </span>
      ),
    }
  }

  function totalColumn<T extends { totalScore: number }>(): RankingColumn<T> {
    return {
      id: 'total',
      testId: 'leaderboard-column-total',
      header: t('leaderboard.columns.total'),
      mobileLabel: t('leaderboard.columns.total'),
      cell: (row) => <span className="font-bold tabular-nums">{row.totalScore}</span>,
    }
  }

  const roundColumns: RankingColumn<RoundRankingTeam>[] = [
    rankColumn(),
    teamColumn(),
    ...problemIds.map(
      (problemId, index): RankingColumn<RoundRankingTeam> => ({
        id: `problem-${problemId}`,
        testId: `leaderboard-column-problem-${problemId}`,
        header: positionLabel(index),
        headerTitle: problemTitleById.get(problemId),
        mobileLabel: problemTitleById.get(problemId) ?? positionLabel(index),
        cell: (row) => {
          const entry = row.problems.find((problem) => problem.problemId === problemId)
          return entry ? entry.score : t('leaderboard.noSubmission')
        },
      }),
    ),
    totalColumn(),
  ]

  const eventColumns: RankingColumn<EventRankingTeam>[] = [
    rankColumn(),
    teamColumn(),
    ...(eventRanking?.teams[0]?.rounds ?? []).map(
      (round): RankingColumn<EventRankingTeam> => ({
        id: `round-${round.roundId}`,
        testId: `leaderboard-column-round-${round.roundId}`,
        header: round.roundName,
        mobileLabel: round.roundName,
        cell: (row) => {
          const entry = row.rounds.find((r) => r.roundId === round.roundId)
          return entry ? entry.score : t('leaderboard.noSubmission')
        },
      }),
    ),
    totalColumn(),
  ]

  // `stream.event === null` used to sit in this list, which is exactly the
  // condition that enables the REST fallback below — so the fallback fetched
  // the ranking and the screen stayed in loading forever whenever /sse never
  // connected (#180). The rule now is "nothing to show yet, and something is
  // still on its way". Every clause stays paired with its own `enabled`
  // guard: a *disabled* query reports `isPending: true` in TanStack Query
  // (status 'pending', fetchStatus 'idle'), so an unguarded `isPending` would
  // recreate the same deadlock from the other side.
  const isLoading =
    (eventRanking === null && eventRankingRest.isPending) ||
    teams.isPending ||
    rounds.isPending ||
    (!hasActiveRound && lastClosedRound !== null && lastClosedRanking.isPending) ||
    (hasActiveRound && displayedRound === null && activeRoundRanking.isPending)
  // Data first: a failure only takes over the screen when there is no ranking
  // at all to render. Tradeoff: an isolated `rounds.isError` with a working
  // event ranking no longer shows the error state, and the "Rodada" tab falls
  // through to its empty state — accepted so a valid board is never hidden.
  const hasAnyRanking = displayedRound !== null || eventRanking !== null
  const isError =
    !hasAnyRanking &&
    (teams.isError ||
      rounds.isError ||
      lastClosedRanking.isError ||
      activeRoundRanking.isError ||
      eventRankingRest.isError)
  const hasNeverHadARound = !hasActiveRound && lastClosedRound === null
  const defaultTab = hasActiveRound || hasNeverHadARound ? 'round' : 'event'
  const [manualTab, setManualTab] = useState<'round' | 'event' | null>(null)
  const selectedTab = manualTab ?? defaultTab

  function retry() {
    // Reopen the stream too: with /sse blocked the REST refetches alone would
    // leave the screen permanently not-live even after the network recovers.
    stream.reconnect()
    teams.refetch()
    rounds.refetch()
    lastClosedRanking.refetch()
    activeRoundRanking.refetch()
    eventRankingRest.refetch()
  }

  if (isPresentation) {
    return (
      <main ref={mainRef} className="flex flex-1 flex-col bg-background">
        {!isLoading && !isError && (
          <TelaoBoard
            hasActiveRound={hasActiveRound}
            activeRoundId={activeRoundId}
            displayedRound={displayedRound}
            eventRanking={eventRanking}
            lastClosedRound={lastClosedRound}
            closesAt={countdownClosesAt}
            serverTimeOffsetMs={serverTimeOffsetMs}
            myTeamId={myTeamId}
            teamsById={teamsById}
            locale={locale}
            onExit={exitPresentation}
          />
        )}
      </main>
    )
  }

  return (
    <main
      ref={mainRef}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 bg-background p-8"
    >
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display font-bold text-2xl">{t('leaderboard.heading')}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="leaderboard-presentation-toggle"
          aria-pressed={false}
          aria-label={t('leaderboard.presentation.enter')}
          onClick={enterPresentation}
        >
          <Maximize2 className="size-4" />
        </Button>
        {stream.isOffline && (
          <Badge variant="outline" data-testid="leaderboard-not-live-badge">
            {t('leaderboard.notLiveBadge')}
          </Badge>
        )}
        {hasActiveRound && (
          <div className="flex items-center gap-2" data-testid="leaderboard-live-chip">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 animate-pulse rounded-full bg-brand"
            />
            <span className="font-display text-[13px] font-semibold text-brand-text uppercase tracking-[0.12em]">
              {t('leaderboard.liveChip')}
            </span>
          </div>
        )}
        {hasActiveRound && countdownClosesAt !== null && (
          <RoundCountdown
            closesAt={countdownClosesAt}
            serverTimeOffsetMs={serverTimeOffsetMs}
            className="font-display text-brand-text tabular-nums"
          />
        )}
      </div>

      {!stream.isLive && (
        <Alert
          variant={stream.connectionStatus === 'reconnecting' ? 'warning' : 'default'}
          data-testid="leaderboard-connection-banner"
        >
          {stream.connectionStatus === 'reconnecting' && <WifiOff />}
          <AlertDescription>
            {stream.isOffline
              ? t('leaderboard.connection.offline')
              : stream.connectionStatus === 'connecting'
                ? t('leaderboard.connection.connecting')
                : t('leaderboard.connection.reconnecting')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div data-testid="leaderboard-loading" className="flex flex-col gap-3">
          <div className="h-9 w-1/3 animate-pulse rounded-md bg-background-2" />
          <div className="h-16 w-full animate-pulse rounded-md bg-background-2" />
          <div className="h-16 w-full animate-pulse rounded-md bg-background-2" />
        </div>
      )}

      {!isLoading && isError && (
        <Alert variant="destructive" data-testid="leaderboard-error">
          <TriangleAlert />
          <AlertTitle>{t('leaderboard.error.alertTitle')}</AlertTitle>
          <AlertDescription>
            <p>{t('leaderboard.error.message')}</p>
            <Button
              type="button"
              variant="outline"
              data-testid="leaderboard-error-retry"
              onClick={retry}
            >
              {t('leaderboard.error.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && (
        <Tabs
          value={selectedTab}
          onValueChange={(value) => setManualTab(value as 'round' | 'event')}
        >
          <TabsList data-testid="leaderboard-tabs">
            <TabsTrigger value="round" data-testid="leaderboard-tab-round">
              {t('leaderboard.tabs.round')}
            </TabsTrigger>
            <TabsTrigger value="event" data-testid="leaderboard-tab-event">
              {t('leaderboard.tabs.event')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="round">
            {displayedRound === null ? (
              <div
                data-testid="leaderboard-empty-no-round"
                className="flex flex-col items-center gap-2 p-8 text-center"
              >
                <p className="text-muted-foreground">{t('leaderboard.empty.noRoundEver')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {isLastClosedRound && (
                  <p
                    className="text-muted-foreground text-sm"
                    data-testid="leaderboard-last-closed-label"
                  >
                    {t('leaderboard.lastClosedRoundLabel', { name: displayedRound.roundName })}
                  </p>
                )}
                {displayedRound.teams.length === 0 ? (
                  <div
                    data-testid="leaderboard-empty"
                    className="flex flex-col items-center gap-2 p-8 text-center"
                  >
                    <p className="text-muted-foreground">
                      {t('leaderboard.empty.noSubmissionsYet')}
                    </p>
                  </div>
                ) : (
                  <>
                    <RankingTable
                      columns={roundColumns}
                      rows={displayedRound.teams}
                      myTeamId={myTeamId}
                    />
                    <ul
                      data-testid="leaderboard-legend"
                      className="flex flex-col gap-1 text-muted-foreground text-sm"
                    >
                      {problemIds.map((problemId, index) => (
                        <li key={problemId} data-testid={`leaderboard-legend-item-${problemId}`}>
                          {t('leaderboard.legend.entry', {
                            letter: positionLabel(index),
                            title:
                              problemTitleById.get(problemId) ?? t('leaderboard.legend.loading'),
                          })}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="event">
            {eventRanking === null || eventRanking.teams.length === 0 ? (
              <div
                data-testid="leaderboard-empty"
                className="flex flex-col items-center gap-2 p-8 text-center"
              >
                <p className="text-muted-foreground">{t('leaderboard.empty.title')}</p>
              </div>
            ) : (
              <RankingTable columns={eventColumns} rows={eventRanking.teams} myTeamId={myTeamId} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}
