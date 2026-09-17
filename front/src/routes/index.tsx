import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Mark } from '@/components/brand/mark'
import { Wordmark } from '@/components/brand/wordmark'
import { RoundCountdown } from '@/components/round-countdown'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoundStream } from '@/hooks/use-round-stream'
import { useSession } from '@/hooks/use-session'
import { formatDate } from '@/i18n/format'
import { fetchRoundRanking } from '@/lib/ranking-query'
import { fetchRounds, ROUNDS_QUERY_KEY } from '@/lib/rounds-query'
import { fetchTeams, TEAMS_QUERY_KEY } from '@/lib/teams-query'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ notice: z.enum(['forbidden-organizer']).optional() }).parse(search),
  component: Home,
})

function Home() {
  const { t, i18n } = useTranslation()
  const navigate = Route.useNavigate()
  const { notice } = Route.useSearch()
  const { status, user } = useSession()
  const isAuthenticated = status === 'authenticated'
  const queryClient = useQueryClient()
  // Same cache entry the /teams screen fills, so arriving there is instant
  // and leaving/joining refreshes this card too.
  const teams = useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: fetchTeams,
    enabled: isAuthenticated,
  })
  const myTeam = teams.data?.teams.find((team) => team.id === teams.data?.myTeamId) ?? null

  const eventStream = useRoundStream()
  const rounds = useQuery({
    queryKey: ROUNDS_QUERY_KEY,
    queryFn: fetchRounds,
    enabled: isAuthenticated,
  })
  // round.opened/round.closed refetch the list above so a newly opened
  // round's name resolves and the closed-rounds list stays current — the
  // countdown itself already updates from the pushed event, without this.
  // `roundChangedAt` is shared by every consumer of the round stream
  // (#217), so the ref skips the value it already saw on mount instead of
  // invalidating on first render.
  const lastRoundChangeRef = useRef(eventStream.roundChangedAt)
  useEffect(() => {
    if (eventStream.roundChangedAt === lastRoundChangeRef.current) return
    lastRoundChangeRef.current = eventStream.roundChangedAt
    queryClient.invalidateQueries({ queryKey: ROUNDS_QUERY_KEY })
  }, [eventStream.roundChangedAt, queryClient])
  const openRound = rounds.data?.find((round) => round.id === eventStream.currentRoundId)
  // rounds.data comes straight from `.json()` (no client-side zod parsing,
  // unlike the SSE channel), so despite the `Date` type its fields are still
  // wire-format ISO strings at runtime — re-wrap before using as a Date.
  const closesAt =
    eventStream.closesAt ?? (openRound?.closesAt ? new Date(openRound.closesAt) : null)
  const serverTimeOffsetMs = eventStream.serverTime
    ? eventStream.serverTime.getTime() - Date.now()
    : 0
  const closedRounds = (rounds.data?.filter((round) => round.status === 'closed') ?? []).sort(
    (a, b) =>
      (b.closedAt ? new Date(b.closedAt).getTime() : 0) -
      (a.closedAt ? new Date(a.closedAt).getTime() : 0),
  )
  const myTeamId = teams.data?.myTeamId
  const closedRoundRankings = useQueries({
    queries: closedRounds.map((round) => ({
      queryKey: ['ranking', 'round', round.id],
      queryFn: () => fetchRoundRanking(round.id),
      enabled: isAuthenticated && myTeamId != null,
    })),
  })
  const myResultByRoundId = new Map(
    closedRounds
      .map((round, index) => {
        const myTeamResult = closedRoundRankings[index]?.data?.teams.find(
          (team) => team.teamId === myTeamId,
        )
        // getRoundRanking (#184) omits a team from a round it never
        // submitted in — myTeamResult is undefined for those, not zeroed.
        return myTeamResult != null
          ? ([round.id, { rank: myTeamResult.rank, totalScore: myTeamResult.totalScore }] as const)
          : null
      })
      .filter((entry) => entry !== null),
  )

  const latestRound = closedRounds[0]
  const latestResult = latestRound ? myResultByRoundId.get(latestRound.id) : undefined
  const hasOpenRound = Boolean(eventStream.currentRoundId && closesAt)
  const eyebrow = 'font-display text-[13px] font-semibold uppercase tracking-[0.12em]'

  return (
    <main
      data-testid="home-screen"
      className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-5 px-4 py-6 md:gap-7 md:px-8 md:py-14"
    >
      {notice === 'forbidden-organizer' && (
        <Alert variant="destructive" data-testid="home-notice-banner">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('home.notices.forbiddenOrganizer')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="home-notice-dismiss"
              onClick={() => navigate({ to: '/', search: {}, replace: true })}
            >
              {t('home.notices.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col items-center gap-4 text-center md:gap-6">
        <Mark className="size-14 md:size-20" />
        <h1 data-testid="home-heading">
          <span className="sr-only">kumite</span>
          <Wordmark className="h-12 w-36 md:h-16 md:w-48" />
        </h1>
        <p className={`${eyebrow} text-muted-foreground`}>{t('home.tagline')}</p>
      </div>
      {isAuthenticated && (
        <Card
          className={`w-full gap-3 py-5 shadow-none ${hasOpenRound ? 'border-brand' : ''}`}
          data-testid="home-round-card"
        >
          <CardContent className="flex flex-col items-start gap-4 px-5 md:flex-row md:items-center md:justify-between md:px-6">
            {eventStream.currentRoundId && closesAt ? (
              <>
                <div className="flex min-w-0 flex-col gap-2">
                  <span
                    data-testid="home-round-live"
                    className={`${eyebrow} flex items-center gap-2 text-brand-text`}
                  >
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
                    {t('home.round.live')}
                  </span>
                  {openRound && (
                    <h2 className="wrap-anywhere font-display font-semibold text-2xl leading-tight">
                      {openRound.name}
                    </h2>
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground text-sm">
                    {openRound && (
                      <span>{t('home.round.problemCount', { count: openRound.problemCount })}</span>
                    )}
                    <RoundCountdown
                      closesAt={closesAt}
                      serverTimeOffsetMs={serverTimeOffsetMs}
                      roundName={openRound?.name}
                      className="font-display font-semibold text-brand-text tabular-nums"
                    />
                  </div>
                </div>
                <Button
                  asChild
                  data-testid="home-round-cta"
                  className="h-11 shrink-0 bg-brand text-brand-foreground shadow-none hover:bg-brand-hover"
                >
                  <Link to="/rounds/$id" params={{ id: eventStream.currentRoundId }}>
                    {t('home.round.cta')}
                  </Link>
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">{t('home.round.waiting')}</span>
            )}
          </CardContent>
        </Card>
      )}
      {isAuthenticated && (
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <Card className="min-w-0 gap-4 shadow-none" data-testid="home-team-card">
            <CardHeader>
              <CardTitle className={`${eyebrow} text-muted-foreground`}>
                {t('home.team.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              {teams.isPending && (
                <span className="text-muted-foreground text-sm">{t('teams.loading')}</span>
              )}
              {teams.data &&
                (myTeam ? (
                  <>
                    <h2 className="wrap-anywhere font-display font-semibold text-2xl">
                      {myTeam.name}
                    </h2>
                    <span className="text-muted-foreground text-sm">
                      {t('home.team.memberCount', {
                        members: myTeam.members.length,
                        max: teams.data.maxTeamSize,
                      })}
                    </span>
                    {latestRound && latestResult && (
                      <span
                        data-testid="home-team-last-result"
                        className="wrap-anywhere text-muted-foreground text-sm tabular-nums"
                      >
                        {t('home.team.lastResult', {
                          rank: latestResult.rank,
                          name: latestRound.name,
                        })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">{t('home.team.none')}</span>
                ))}
              <Button
                asChild
                variant="outline"
                size="sm"
                data-testid="home-team-cta"
                className="h-11 shadow-none md:h-8"
              >
                <Link to="/teams">{t('home.team.cta')}</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="min-w-0 gap-4 shadow-none" data-testid="home-closed-rounds">
            <CardHeader>
              <CardTitle className={`${eyebrow} text-muted-foreground`}>
                {t('home.closedRounds.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {closedRounds.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  {t('home.closedRounds.empty')}
                </span>
              ) : (
                closedRounds.map((round) => {
                  const myResult = myResultByRoundId.get(round.id)
                  return (
                    <div
                      key={round.id}
                      className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t pt-3 text-sm"
                    >
                      <Link
                        to="/rounds/$id"
                        params={{ id: round.id }}
                        data-testid={`home-closed-round-${round.id}`}
                        className="min-w-0 wrap-anywhere text-foreground underline-offset-4 hover:underline"
                      >
                        {round.name}
                      </Link>
                      <div className="flex min-w-0 flex-wrap items-baseline gap-2 text-muted-foreground text-xs tabular-nums">
                        {myResult && (
                          <span data-testid={`home-closed-round-result-${round.id}`}>
                            {t('home.closedRounds.result', {
                              rank: myResult.rank,
                              score: myResult.totalScore,
                            })}
                          </span>
                        )}
                        {round.closedAt && (
                          <span>
                            {t('home.closedRounds.closedAt', {
                              date: formatDate(
                                new Date(round.closedAt),
                                i18n.resolvedLanguage ?? i18n.language,
                              ),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {isAuthenticated && user?.role === 'organizer' && (
        <Card className="gap-4 shadow-none" data-testid="home-organizer-shortcuts">
          <CardHeader>
            <CardTitle className={`${eyebrow} text-muted-foreground`}>
              {t('home.organizerShortcuts.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" data-testid="home-organizer-shortcuts-problems">
              <Link to="/organizer/problems">{t('home.organizerShortcuts.problems')}</Link>
            </Button>
            <Button asChild size="sm" data-testid="home-organizer-shortcuts-rounds">
              <Link to="/organizer/rounds">{t('home.organizerShortcuts.rounds')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
