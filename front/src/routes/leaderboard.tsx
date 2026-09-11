import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Maximize2, Minimize2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RoundCountdown } from '@/components/round-countdown'
import { type University, UniversityBadge } from '@/components/teams/university-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLeaderboardStream } from '@/hooks/use-leaderboard-stream'
import { api } from '@/lib/api'
import { fetchEventRanking, fetchRoundRanking } from '@/lib/ranking-query'
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

// Table row classes mirror ui/table.tsx's TableRow — needed here because the
// position-change animation (#45 plan) requires `motion.tr`, not the plain
// `<tr>` that component renders.
const ROW_CLASSNAME = 'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted'

function universitiesForTeam(
  teamId: string,
  teamsById: Map<string, { members: { university: University }[] }>,
): University[] {
  const team = teamsById.get(teamId)
  if (!team) return []
  return [...new Set(team.members.map((member) => member.university))]
}

function LeaderboardScreen() {
  const { t, i18n } = useTranslation()
  const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)
  const queryClient = useQueryClient()
  const mainRef = useRef<HTMLElement>(null)
  const [isPresentation, setIsPresentation] = useState(false)

  useEffect(() => {
    function handleFullscreenChange() {
      setIsPresentation(document.fullscreenElement === mainRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const togglePresentation = useCallback(() => {
    if (isPresentation) {
      setIsPresentation(false)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      return
    }
    // Set optimistically: if the Fullscreen API is unsupported or the
    // request is denied, the enlarged layout still applies (degrade
    // gracefully) — a real transition later confirms the same state via
    // the fullscreenchange listener above.
    setIsPresentation(true)
    mainRef.current?.requestFullscreen().catch(() => {})
  }, [isPresentation])
  // round.opened/round.closed refetch the list so a round that just closed
  // (or opened) resolves in `closedRounds`/`lastClosedRound` right away,
  // instead of staying stuck on the stale snapshot until something else
  // happens to refetch it — same pattern as index.tsx's invalidateRounds.
  const invalidateRounds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ROUNDS_QUERY_KEY })
  }, [queryClient])
  const stream = useLeaderboardStream(invalidateRounds)

  const teams = useQuery({ queryKey: TEAMS_QUERY_KEY, queryFn: fetchTeams })
  const rounds = useQuery({ queryKey: ROUNDS_QUERY_KEY, queryFn: fetchRounds })

  const hasActiveRound = stream.activeRoundId !== null
  const serverTimeOffsetMs = stream.serverTime ? stream.serverTime.getTime() - Date.now() : 0
  const closedRounds = (rounds.data ?? [])
    .filter((round) => round.status === 'closed' && round.closedAt)
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
  const lastClosedRound = closedRounds[0] ?? null

  const lastClosedRanking = useQuery({
    queryKey: ['ranking', 'round', lastClosedRound?.id],
    queryFn: () => fetchRoundRanking(lastClosedRound!.id),
    enabled: !hasActiveRound && lastClosedRound !== null,
  })

  // `ranking.updated` only re-publishes on a submission-driven dirty tick
  // (#44) — a round that opens with zero submissions never arrives via SSE
  // on its own, so fetch it once over REST as soon as `activeRoundId` shows
  // up. A later `ranking.updated` for this round overrides it (see below).
  const activeRoundRanking = useQuery({
    queryKey: ['ranking', 'round', stream.activeRoundId],
    queryFn: () => fetchRoundRanking(stream.activeRoundId!),
    enabled: hasActiveRound && stream.round === null,
  })

  const eventRankingRest = useQuery({
    queryKey: ['ranking', 'event'],
    queryFn: fetchEventRanking,
    enabled: stream.event === null,
  })

  const displayedRound: RoundRanking | null = hasActiveRound
    ? (stream.round ?? activeRoundRanking.data ?? null)
    : (lastClosedRanking.data ?? null)
  const isLastClosedRound = !hasActiveRound && displayedRound !== null
  const eventRanking = stream.event ?? eventRankingRest.data ?? null

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
  const problemTitleById = new Map(
    problemIds.map((problemId, index) => [
      problemId,
      problemQueries[index]?.data?.title ??
        t('leaderboard.columns.problemFallback', { position: index + 1 }),
    ]),
  )

  const teamsById = new Map((teams.data?.teams ?? []).map((team) => [team.id, team]))
  const myTeamId = teams.data?.myTeamId ?? null

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
    teams.refetch()
    rounds.refetch()
    lastClosedRanking.refetch()
    activeRoundRanking.refetch()
    eventRankingRest.refetch()
  }

  return (
    <main
      ref={mainRef}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 bg-background p-8"
    >
      <div className="flex items-center gap-4">
        <h1 className={cn('font-bold text-2xl', isPresentation && 'text-5xl')}>
          {t('leaderboard.heading')}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="leaderboard-presentation-toggle"
          aria-pressed={isPresentation}
          aria-label={t(
            isPresentation ? 'leaderboard.presentation.exit' : 'leaderboard.presentation.enter',
          )}
          onClick={togglePresentation}
        >
          {isPresentation ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
        {isPresentation && hasActiveRound && stream.closesAt !== null && (
          <RoundCountdown closesAt={stream.closesAt} serverTimeOffsetMs={serverTimeOffsetMs} />
        )}
      </div>

      {stream.connectionStatus !== 'open' && (
        <Alert data-testid="leaderboard-connection-banner">
          <AlertDescription>
            {stream.connectionStatus === 'connecting'
              ? t('leaderboard.connection.connecting')
              : t('leaderboard.connection.reconnecting')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <p data-testid="leaderboard-loading">{t('leaderboard.loading')}</p>}

      {!isLoading && isError && (
        <div data-testid="leaderboard-error" className="flex flex-col items-start gap-2">
          <p>{t('leaderboard.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="leaderboard-error-retry"
            onClick={retry}
          >
            {t('leaderboard.error.retry')}
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <Tabs
          value={selectedTab}
          onValueChange={(value) => setManualTab(value as 'round' | 'event')}
        >
          <TabsList data-testid="leaderboard-tabs">
            <TabsTrigger
              value="round"
              data-testid="leaderboard-tab-round"
              className={cn(isPresentation && 'text-xl')}
            >
              {t('leaderboard.tabs.round')}
            </TabsTrigger>
            <TabsTrigger
              value="event"
              data-testid="leaderboard-tab-event"
              className={cn(isPresentation && 'text-xl')}
            >
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
            ) : displayedRound.teams.length === 0 ? (
              <div
                data-testid="leaderboard-empty"
                className="flex flex-col items-center gap-2 p-8 text-center"
              >
                <p className="text-muted-foreground">{t('leaderboard.empty.title')}</p>
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
                <Table
                  data-testid="leaderboard-table"
                  className={cn(isPresentation && '[&_td]:text-3xl [&_th]:text-2xl')}
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="leaderboard-column-rank">
                        {t('leaderboard.columns.rank')}
                      </TableHead>
                      <TableHead data-testid="leaderboard-column-team">
                        {t('leaderboard.columns.team')}
                      </TableHead>
                      {problemIds.map((problemId) => (
                        <TableHead
                          key={problemId}
                          data-testid={`leaderboard-column-problem-${problemId}`}
                        >
                          {problemTitleById.get(problemId)}
                        </TableHead>
                      ))}
                      <TableHead data-testid="leaderboard-column-total">
                        {t('leaderboard.columns.total')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRound.teams.map((team: RoundRankingTeam) => (
                      <motion.tr
                        key={team.teamId}
                        layout
                        transition={ROW_TRANSITION}
                        data-testid={`leaderboard-row-${team.teamId}`}
                        className={ROW_CLASSNAME}
                      >
                        <TableCell>{team.rank}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{team.teamName}</span>
                            {team.teamId === myTeamId && (
                              <Badge data-testid="leaderboard-your-team-badge">
                                {t('teams.yourTeamBadge')}
                              </Badge>
                            )}
                            {universitiesForTeam(team.teamId, teamsById).map((university) => (
                              <UniversityBadge key={university} university={university} />
                            ))}
                          </div>
                        </TableCell>
                        {problemIds.map((problemId) => (
                          <TableCell key={problemId}>
                            {team.problems.find((problem) => problem.problemId === problemId)
                              ?.score ?? 0}
                          </TableCell>
                        ))}
                        <TableCell className="font-medium">{team.totalScore}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
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
              <Table
                data-testid="leaderboard-table"
                className={cn(isPresentation && '[&_td]:text-3xl [&_th]:text-2xl')}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="leaderboard-column-rank">
                      {t('leaderboard.columns.rank')}
                    </TableHead>
                    <TableHead data-testid="leaderboard-column-team">
                      {t('leaderboard.columns.team')}
                    </TableHead>
                    {(eventRanking.teams[0]?.rounds ?? []).map((round) => (
                      <TableHead
                        key={round.roundId}
                        data-testid={`leaderboard-column-round-${round.roundId}`}
                      >
                        {round.roundName}
                      </TableHead>
                    ))}
                    <TableHead data-testid="leaderboard-column-total">
                      {t('leaderboard.columns.total')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventRanking.teams.map((team: EventRankingTeam) => (
                    <motion.tr
                      key={team.teamId}
                      layout
                      transition={ROW_TRANSITION}
                      data-testid={`leaderboard-row-${team.teamId}`}
                      className={ROW_CLASSNAME}
                    >
                      <TableCell>{team.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{team.teamName}</span>
                          {team.teamId === myTeamId && (
                            <Badge data-testid="leaderboard-your-team-badge">
                              {t('teams.yourTeamBadge')}
                            </Badge>
                          )}
                          {universitiesForTeam(team.teamId, teamsById).map((university) => (
                            <UniversityBadge key={university} university={university} />
                          ))}
                        </div>
                      </TableCell>
                      {team.rounds.map((round) => (
                        <TableCell key={round.roundId}>{round.score}</TableCell>
                      ))}
                      <TableCell className="font-medium">{team.totalScore}</TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}
