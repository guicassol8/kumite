import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { RoundCountdown } from '@/components/round-countdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventStream } from '@/hooks/use-event-stream'
import { formatDate } from '@/i18n/format'
import { fetchRoundRanking } from '@/lib/ranking-query'
import { fetchOrganizerStats, ORGANIZER_STATS_QUERY_KEY } from '@/lib/stats-query'

export const Route = createFileRoute('/organizer/')({
  component: OrganizerOverviewScreen,
})

// The event's numbers at a glance (#54). Everything here is derived
// server-side on read, so "live" is just a matter of refetching: the SSE
// channel (#38) announces what it knows about (round transitions, and a
// scored submission via ranking.updated), and a slow interval covers what it
// doesn't announce at all — a new signup, a team formed.
const STATS_REFETCH_INTERVAL_MS = 30_000

function OrganizerOverviewScreen() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage ?? i18n.language

  const stats = useQuery({
    queryKey: ORGANIZER_STATS_QUERY_KEY,
    queryFn: fetchOrganizerStats,
    refetchInterval: STATS_REFETCH_INTERVAL_MS,
  })

  const invalidateStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ORGANIZER_STATS_QUERY_KEY })
  }, [queryClient])
  // A round opening or closing changes both the numbers and which round the
  // card is about, so the podium query goes stale with them.
  const onRoundChange = useCallback(() => {
    invalidateStats()
    queryClient.invalidateQueries({ queryKey: ['ranking'] })
  }, [invalidateStats, queryClient])
  const eventStream = useEventStream(onRoundChange, invalidateStats)

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
      <h2 className="font-semibold text-xl" data-testid="overview-heading">
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card data-testid="overview-signups-card">
              <CardHeader>
                <CardTitle>{t('organizer.overview.signups.title')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <span className="font-bold text-3xl" data-testid="overview-signups-total">
                  {stats.data.participants.total}
                </span>
                <span
                  className="text-muted-foreground text-sm"
                  data-testid="overview-signups-pucrs"
                >
                  {t('organizer.overview.signups.pucrs', { count: stats.data.participants.pucrs })}
                </span>
                <span
                  className="text-muted-foreground text-sm"
                  data-testid="overview-signups-merida"
                >
                  {t('organizer.overview.signups.merida', {
                    count: stats.data.participants.merida,
                  })}
                </span>
              </CardContent>
            </Card>

            <Card data-testid="overview-teams-card">
              <CardHeader>
                <CardTitle>{t('organizer.overview.teams.title')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <span className="font-bold text-3xl" data-testid="overview-teams-total">
                  {stats.data.teams.total}
                </span>
                <span
                  className="text-muted-foreground text-sm"
                  data-testid="overview-teams-members"
                >
                  {t('organizer.overview.teams.members', {
                    inTeam: stats.data.participants.inTeam,
                    total: stats.data.participants.total,
                  })}
                </span>
                <span className="text-muted-foreground text-sm" data-testid="overview-teams-slots">
                  {t('organizer.overview.teams.openSlots', { count: stats.data.teams.openSlots })}
                </span>
                <span
                  className="text-muted-foreground text-sm"
                  data-testid="overview-teams-without-team"
                >
                  {t('organizer.overview.teams.withoutTeam', {
                    count: stats.data.participants.withoutTeam,
                  })}
                </span>
              </CardContent>
            </Card>

            <Card data-testid="overview-submissions-card">
              <CardHeader>
                <CardTitle>{t('organizer.overview.submissions.title')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <span className="font-bold text-3xl" data-testid="overview-submissions-total">
                  {stats.data.submissions.total}
                </span>
                {stats.data.submissions.inRound !== null && (
                  <span
                    className="text-muted-foreground text-sm"
                    data-testid="overview-submissions-in-round"
                  >
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
          </div>

          <Card data-testid="overview-round-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{t('organizer.overview.round.title')}</CardTitle>
              {eventStream.status !== 'open' && (
                <Badge variant="outline" data-testid="overview-stream-status">
                  {t('organizer.overview.round.streamOffline')}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-2">
              {activeRound && closesAt ? (
                <>
                  <span className="font-medium" data-testid="overview-round-name">
                    {activeRound.name}
                  </span>
                  <RoundCountdown closesAt={closesAt} serverTimeOffsetMs={serverTimeOffsetMs} />
                  <Button asChild size="sm" data-testid="overview-round-cta">
                    <Link to="/organizer/rounds">{t('organizer.overview.round.manageCta')}</Link>
                  </Button>
                </>
              ) : lastClosedRound ? (
                <>
                  <span className="font-medium" data-testid="overview-round-name">
                    {t('organizer.overview.round.lastClosed', { name: lastClosedRound.name })}
                  </span>
                  {lastClosedRound.closedAt && (
                    <span
                      className="text-muted-foreground text-sm"
                      data-testid="overview-round-closed-at"
                    >
                      {t('organizer.overview.round.closedAt', {
                        date: formatDate(new Date(lastClosedRound.closedAt), locale),
                      })}
                    </span>
                  )}
                  <ol className="flex flex-col gap-1" data-testid="overview-round-podium">
                    {podium.length === 0 ? (
                      <span
                        className="text-muted-foreground text-sm"
                        data-testid="overview-round-podium-empty"
                      >
                        {t('organizer.overview.round.podiumEmpty')}
                      </span>
                    ) : (
                      podium.map((team) => (
                        <li
                          key={team.teamId}
                          className="text-sm"
                          data-testid={`overview-round-podium-${team.teamId}`}
                        >
                          {t('organizer.overview.round.podiumEntry', {
                            rank: team.rank,
                            name: team.teamName,
                            score: team.totalScore,
                          })}
                        </li>
                      ))
                    )}
                  </ol>
                  <Button asChild size="sm" variant="outline" data-testid="overview-round-cta">
                    <Link to="/leaderboard">{t('organizer.overview.round.leaderboardCta')}</Link>
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground text-sm" data-testid="overview-round-none">
                  {t('organizer.overview.round.none')}
                </span>
              )}
            </CardContent>
          </Card>

          <Card data-testid="overview-shortcuts-card">
            <CardHeader>
              <CardTitle>{t('organizer.overview.shortcuts.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline" data-testid="overview-shortcuts-problems">
                <Link to="/organizer/problems">{t('organizer.nav.problems')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline" data-testid="overview-shortcuts-rounds">
                <Link to="/organizer/rounds">{t('organizer.nav.rounds')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline" data-testid="overview-shortcuts-teams">
                <Link to="/organizer/teams">{t('organizer.nav.teams')}</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                data-testid="overview-shortcuts-event-config"
              >
                <Link to="/organizer/event-config">{t('organizer.nav.eventConfig')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline" data-testid="overview-shortcuts-users">
                <Link to="/organizer/users">{t('organizer.nav.users')}</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
