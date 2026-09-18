import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PANEL_EYEBROW } from '@/components/organizer/panel-table'
import { RoundCountdown } from '@/components/round-countdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoundStream } from '@/hooks/use-round-stream'
import { formatDate } from '@/i18n/format'
import { fetchRoundRanking } from '@/lib/ranking-query'
import { fetchOrganizerStats, ORGANIZER_STATS_QUERY_KEY } from '@/lib/stats-query'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/organizer/')({
  component: OrganizerOverviewScreen,
})

// The event's numbers at a glance (#54). Everything here is derived
// server-side on read, so "live" is just a matter of refetching: the SSE
// channel (#38) announces what it knows about (round transitions, and a
// scored submission via ranking.updated), and a slow interval covers what it
// doesn't announce at all — a new signup, a team formed.
const STATS_REFETCH_INTERVAL_MS = 30_000

// The "stat" role from the identity's type scale: 44px display, tabular so a
// number changing under SSE does not shift the card's width.
const STAT = 'font-bold font-display text-[44px] leading-none tabular-nums'
const CARD_TITLE = `${PANEL_EYEBROW} text-muted-foreground`
const DETAIL = 'text-muted-foreground text-sm'

function OrganizerOverviewScreen() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage ?? i18n.language

  const stats = useQuery({
    queryKey: ORGANIZER_STATS_QUERY_KEY,
    queryFn: fetchOrganizerStats,
    refetchInterval: STATS_REFETCH_INTERVAL_MS,
  })

  const eventStream = useRoundStream()
  // A round opening or closing changes both the numbers and which round the
  // card is about, so the podium query goes stale with them; a scored
  // submission (ranking.updated) only changes the numbers. Both are shared
  // signals off the app-wide stream (#217) — the refs skip the value each
  // already saw on mount instead of invalidating on first render.
  const lastRoundChangeRef = useRef(eventStream.roundChangedAt)
  useEffect(() => {
    if (eventStream.roundChangedAt === lastRoundChangeRef.current) return
    lastRoundChangeRef.current = eventStream.roundChangedAt
    queryClient.invalidateQueries({ queryKey: ORGANIZER_STATS_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: ['ranking'] })
  }, [eventStream.roundChangedAt, queryClient])
  const lastRankingUpdateRef = useRef(eventStream.rankingUpdatedAt)
  useEffect(() => {
    if (eventStream.rankingUpdatedAt === lastRankingUpdateRef.current) return
    lastRankingUpdateRef.current = eventStream.rankingUpdatedAt
    queryClient.invalidateQueries({ queryKey: ORGANIZER_STATS_QUERY_KEY })
  }, [eventStream.rankingUpdatedAt, queryClient])

  const activeRound = stats.data?.round.active ?? null
  const lastClosedRound = stats.data?.round.lastClosed ?? null
  // No podium while a round is open — the card shows the running timer
  // instead, and a live ranking would be a spoiler mid-round.
  const podiumRoundId = activeRound ? null : (lastClosedRound?.id ?? null)
  const podiumRanking = useQuery({
    queryKey: ['ranking', 'round', podiumRoundId],
    queryFn: () => fetchRoundRanking(podiumRoundId as string),
    enabled: podiumRoundId !== null,
  })
  // getRoundRanking (#184) already omits a team that never submitted in the
  // round, so the ranking itself is the podium's source, just capped to top 3.
  const podium = (podiumRanking.data?.teams ?? []).slice(0, 3)

  // stats.data comes straight from `.json()`, so its date fields are still
  // wire-format ISO strings at runtime despite the `Date` type — re-wrap
  // before using them as dates.
  const closesAt =
    eventStream.closesAt ?? (activeRound?.closesAt ? new Date(activeRound.closesAt) : null)
  const serverTimeOffsetMs = eventStream.serverTime
    ? eventStream.serverTime.getTime() - Date.now()
    : 0

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="font-display font-semibold text-2xl uppercase tracking-[0.01em]"
        data-testid="overview-heading"
      >
        {t('organizer.overview.heading')}
      </h2>

      {stats.isPending && <p data-testid="overview-loading">{t('organizer.overview.loading')}</p>}

      {stats.isError && (
        <div data-testid="overview-error" className="flex flex-col items-start gap-2">
          <p>{t('organizer.overview.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="overview-retry"
            onClick={() => stats.refetch()}
          >
            {t('organizer.overview.error.retry')}
          </Button>
        </div>
      )}

      {stats.data && (
        <>
          {/* Four numeric cards in one row: the mock puts Rodada alongside the
              other three rather than on a wide band of its own. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="overview-signups-card">
              <CardHeader>
                <CardTitle className={CARD_TITLE}>
                  {t('organizer.overview.signups.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className={STAT} data-testid="overview-signups-total">
                  {stats.data.participants.total}
                </span>
                <span className={DETAIL} data-testid="overview-signups-pucrs">
                  {t('organizer.overview.signups.pucrs', { count: stats.data.participants.pucrs })}
                </span>
                <span className={DETAIL} data-testid="overview-signups-merida">
                  {t('organizer.overview.signups.merida', {
                    count: stats.data.participants.merida,
                  })}
                </span>
              </CardContent>
            </Card>

            <Card data-testid="overview-teams-card">
              <CardHeader>
                <CardTitle className={CARD_TITLE}>{t('organizer.overview.teams.title')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className={STAT} data-testid="overview-teams-total">
                  {stats.data.teams.total}
                </span>
                <span className={DETAIL} data-testid="overview-teams-members">
                  {t('organizer.overview.teams.members', {
                    inTeam: stats.data.participants.inTeam,
                    total: stats.data.participants.total,
                  })}
                </span>
                <span className={DETAIL} data-testid="overview-teams-slots">
                  {t('organizer.overview.teams.openSlots', { count: stats.data.teams.openSlots })}
                </span>
                <span className={DETAIL} data-testid="overview-teams-without-team">
                  {t('organizer.overview.teams.withoutTeam', {
                    count: stats.data.participants.withoutTeam,
                  })}
                </span>
              </CardContent>
            </Card>

            <Card data-testid="overview-submissions-card">
              <CardHeader>
                <CardTitle className={CARD_TITLE}>
                  {t('organizer.overview.submissions.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <span className={STAT} data-testid="overview-submissions-total">
                  {stats.data.submissions.total}
                </span>
                {stats.data.submissions.inRound !== null && (
                  <span className={DETAIL} data-testid="overview-submissions-in-round">
                    {t(
                      activeRound
                        ? 'organizer.overview.submissions.inActiveRound'
                        : 'organizer.overview.submissions.inLastRound',
                      { count: stats.data.submissions.inRound },
                    )}
                  </span>
                )}
              </CardContent>
            </Card>

            {/* An open round is the one thing on this screen that is happening
                right now, so it is the only card the identity lets carry the
                brand border. */}
            <Card data-testid="overview-round-card" className={cn(activeRound && 'border-brand')}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className={CARD_TITLE}>{t('organizer.overview.round.title')}</CardTitle>
                {eventStream.status !== 'open' && (
                  <Badge variant="outline" data-testid="overview-stream-status">
                    {t('organizer.overview.round.streamOffline')}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-2">
                {activeRound && closesAt ? (
                  <>
                    <span
                      className={cn(PANEL_EYEBROW, 'flex items-center gap-1.5 text-brand-text')}
                      data-testid="overview-round-open-state"
                    >
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                      {t('organizer.overview.round.openState')}
                    </span>
                    <span className="font-medium" data-testid="overview-round-name">
                      {activeRound.name}
                    </span>
                    <RoundCountdown
                      closesAt={closesAt}
                      serverTimeOffsetMs={serverTimeOffsetMs}
                      roundName={activeRound.name}
                      bare
                      className={cn(STAT, 'text-brand-text')}
                    />
                  </>
                ) : lastClosedRound ? (
                  <span className="font-medium" data-testid="overview-round-name">
                    {t('organizer.overview.round.lastClosed', { name: lastClosedRound.name })}
                  </span>
                ) : (
                  <span className={DETAIL} data-testid="overview-round-none">
                    {t('organizer.overview.round.none')}
                  </span>
                )}

                {(activeRound || lastClosedRound) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button asChild size="sm" data-testid="overview-round-cta">
                      <Link to="/organizer/rounds">{t('organizer.overview.round.manageCta')}</Link>
                    </Button>
                    {/* Until #223 these two shared `overview-round-cta`, because
                        only one of them was ever on screen; now that both are,
                        the leaderboard link needs a name of its own. */}
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      data-testid="overview-round-leaderboard-cta"
                    >
                      <Link to="/leaderboard">{t('organizer.overview.round.leaderboardCta')}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Same condition as before: a podium only while no round is open
                and one has already closed. */}
            {!activeRound && lastClosedRound && (
              <Card data-testid="overview-podium-card">
                <CardHeader className="gap-1">
                  <CardTitle className={CARD_TITLE}>
                    {t('organizer.overview.round.podiumTitle', { name: lastClosedRound.name })}
                  </CardTitle>
                  {lastClosedRound.closedAt && (
                    <span className={DETAIL} data-testid="overview-round-closed-at">
                      {t('organizer.overview.round.closedAt', {
                        date: formatDate(new Date(lastClosedRound.closedAt), locale),
                      })}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col" data-testid="overview-round-podium">
                    {podium.length === 0 ? (
                      <span className={DETAIL} data-testid="overview-round-podium-empty">
                        {t('organizer.overview.round.podiumEmpty')}
                      </span>
                    ) : (
                      podium.map((team) => (
                        <li
                          key={team.teamId}
                          data-testid={`overview-round-podium-${team.teamId}`}
                          className="flex items-center gap-3 border-border border-b py-3 last:border-b-0"
                        >
                          <span
                            className={cn(
                              'font-bold font-display text-2xl leading-none tabular-nums',
                              // Only the winner takes the brand numeral.
                              team.rank === 1 ? 'text-brand-text' : 'text-muted-foreground',
                            )}
                          >
                            {team.rank}
                          </span>
                          <span className="min-w-0 flex-1 wrap-anywhere font-medium text-sm">
                            {team.teamName}
                          </span>
                          <span className="font-display font-semibold text-sm tabular-nums">
                            {t('organizer.overview.round.podiumPoints', {
                              score: team.totalScore,
                            })}
                          </span>
                        </li>
                      ))
                    )}
                  </ol>
                </CardContent>
              </Card>
            )}

            <Card data-testid="overview-shortcuts-card">
              <CardHeader>
                <CardTitle className={CARD_TITLE}>
                  {t('organizer.overview.shortcuts.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* A list of links with hairlines, not a row of buttons: five
                    of them wrapped into a ragged block at panel width. */}
                <ul className="flex flex-col">
                  {(
                    [
                      ['overview-shortcuts-problems', '/organizer/problems', 'problems'],
                      ['overview-shortcuts-rounds', '/organizer/rounds', 'rounds'],
                      ['overview-shortcuts-teams', '/organizer/teams', 'teams'],
                      ['overview-shortcuts-event-config', '/organizer/event-config', 'eventConfig'],
                      ['overview-shortcuts-users', '/organizer/users', 'users'],
                    ] as const
                  ).map(([testId, to, key]) => (
                    <li key={testId} className="border-border border-b last:border-b-0">
                      <Link
                        to={to}
                        data-testid={testId}
                        className="flex items-center justify-between gap-2 py-3 font-medium text-sm hover:text-brand-text"
                      >
                        {t(`organizer.nav.${key}`)}
                        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
