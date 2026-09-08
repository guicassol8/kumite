import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { RoundCountdown } from '@/components/round-countdown'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventStream } from '@/hooks/use-event-stream'
import { useSession } from '@/hooks/use-session'
import { formatDate } from '@/i18n/format'
import { api } from '@/lib/api'
import { fetchRoundRanking } from '@/lib/ranking-query'
import { fetchRounds, ROUNDS_QUERY_KEY } from '@/lib/rounds-query'
import { fetchTeams, TEAMS_QUERY_KEY } from '@/lib/teams-query'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ notice: z.enum(['forbidden-organizer']).optional() }).parse(search),
  component: Home,
})

// Terraform proof page: exercises the typed RPC client end to end. `res.json()`
// below is typed straight from the back's HealthSchema — no codegen involved.
function Home() {
  const { t, i18n } = useTranslation()
  const navigate = Route.useNavigate()
  const { notice } = Route.useSearch()
  const { status, user } = useSession()
  const isAuthenticated = status === 'authenticated'
  const queryClient = useQueryClient()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get()
      if (!res.ok) throw new Error('health check failed')
      return res.json()
    },
  })
  // Same cache entry the /teams screen fills, so arriving there is instant
  // and leaving/joining refreshes this card too.
  const teams = useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: fetchTeams,
    enabled: isAuthenticated,
  })
  const myTeam = teams.data?.teams.find((team) => team.id === teams.data?.myTeamId) ?? null

  // round.opened/round.closed refetch the list below so a newly opened
  // round's name resolves and the closed-rounds list stays current — the
  // countdown itself already updates from the pushed event, without this.
  const invalidateRounds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ROUNDS_QUERY_KEY })
  }, [queryClient])
  const eventStream = useEventStream(invalidateRounds)
  const rounds = useQuery({
    queryKey: ROUNDS_QUERY_KEY,
    queryFn: fetchRounds,
    enabled: isAuthenticated,
  })
  const openRound = rounds.data?.find((round) => round.id === eventStream.currentRoundId)
  // rounds.data comes straight from `.json()` (no client-side zod parsing,
  // unlike the SSE channel), so despite the `Date` type its fields are still
  // wire-format ISO strings at runtime — re-wrap before using as a Date.
  const closesAt =
    eventStream.closesAt ?? (openRound?.closesAt ? new Date(openRound.closesAt) : null)
  const serverTimeOffsetMs = eventStream.serverTime
    ? eventStream.serverTime.getTime() - Date.now()
    : 0
  const closedRounds = rounds.data?.filter((round) => round.status === 'closed') ?? []
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
        return myTeamResult
          ? ([round.id, { rank: myTeamResult.rank, totalScore: myTeamResult.totalScore }] as const)
          : null
      })
      .filter((entry) => entry !== null),
  )

  return (
    <main className="mx-auto flex flex-1 max-w-xl flex-col items-center justify-center gap-6 p-8">
      {notice === 'forbidden-organizer' && (
        <Alert variant="destructive" data-testid="home-notice-banner" className="w-full">
          <AlertDescription className="flex items-center justify-between gap-4">
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
      <h1 className="font-bold text-4xl tracking-tight">kumite</h1>
      <p className="text-muted-foreground">{t('home.tagline')}</p>
      {isAuthenticated && (
        <Card className="w-full" data-testid="home-round-card">
          <CardContent>
            {eventStream.currentRoundId && closesAt ? (
              <div className="flex flex-col items-start gap-2">
                {openRound && <span className="font-medium">{openRound.name}</span>}
                <RoundCountdown closesAt={closesAt} serverTimeOffsetMs={serverTimeOffsetMs} />
                <Button asChild size="sm" data-testid="home-round-cta">
                  <Link to="/rounds/$id" params={{ id: eventStream.currentRoundId }}>
                    {t('home.round.cta')}
                  </Link>
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">{t('home.round.waiting')}</span>
            )}
          </CardContent>
        </Card>
      )}
      {isAuthenticated && (
        <Card className="w-full" data-testid="home-team-card">
          <CardHeader>
            <CardTitle>{t('home.team.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            {teams.isPending && (
              <span className="text-muted-foreground text-sm">{t('teams.loading')}</span>
            )}
            {teams.data &&
              (myTeam ? (
                <>
                  <span className="font-medium">{myTeam.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {t('home.team.memberCount', {
                      members: myTeam.members.length,
                      max: teams.data.maxTeamSize,
                    })}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">{t('home.team.none')}</span>
              ))}
            <Button asChild size="sm" data-testid="home-team-cta">
              <Link to="/teams">{t('home.team.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {isAuthenticated && (
        <Card className="w-full" data-testid="home-closed-rounds">
          <CardHeader>
            <CardTitle>{t('home.closedRounds.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            {closedRounds.length === 0 ? (
              <span className="text-muted-foreground text-sm">{t('home.closedRounds.empty')}</span>
            ) : (
              closedRounds.map((round) => {
                const myResult = myResultByRoundId.get(round.id)
                return (
                  <div key={round.id} className="flex w-full items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-2">
                      <Link
                        to="/rounds/$id"
                        params={{ id: round.id }}
                        data-testid={`home-closed-round-${round.id}`}
                        className="text-primary underline"
                      >
                        {round.name}
                      </Link>
                      {myResult && (
                        <span
                          data-testid={`home-closed-round-result-${round.id}`}
                          className="text-muted-foreground text-sm"
                        >
                          {t('home.closedRounds.result', {
                            rank: myResult.rank,
                            score: myResult.totalScore,
                          })}
                        </span>
                      )}
                    </div>
                    {round.closedAt && (
                      <span className="text-muted-foreground text-sm">
                        {t('home.closedRounds.closedAt', {
                          date: formatDate(
                            new Date(round.closedAt),
                            i18n.resolvedLanguage ?? i18n.language,
                          ),
                        })}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}
      {isAuthenticated && user?.role === 'organizer' && (
        <Card className="w-full" data-testid="home-organizer-shortcuts">
          <CardHeader>
            <CardTitle>{t('home.organizerShortcuts.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Button asChild size="sm" data-testid="home-organizer-shortcuts-problems">
              <Link to="/organizer/problems">{t('home.organizerShortcuts.problems')}</Link>
            </Button>
            <Button asChild size="sm" data-testid="home-organizer-shortcuts-rounds">
              <Link to="/organizer/rounds">{t('home.organizerShortcuts.rounds')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <Card className="w-full" data-testid="api-status">
        <CardHeader>
          <CardTitle>{t('home.apiStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isPending && <span data-testid="api-status-loading">{t('home.checking')}</span>}
          {health.isError && <span data-testid="api-status-error">{t('home.apiDown')}</span>}
          {health.data && (
            <span data-testid="api-status-ok">
              {t('home.apiOk', { status: health.data.status })}
            </span>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
