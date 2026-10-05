import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchX, TriangleAlert, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RoundCountdown } from '@/components/round-countdown'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRoundStream } from '@/hooks/use-round-stream'
import { formatTime } from '@/i18n/format'
import { DIFFICULTY_BADGE_STYLE } from '@/lib/difficulty-badge'
import { positionLabel } from '@/lib/round-position'
import { fetchRound, RoundNotFoundError, roundQueryKey } from '@/lib/rounds-query'
import { requireAuth } from '@/lib/route-guards'
import { fetchTeams, TEAMS_QUERY_KEY } from '@/lib/teams-query'
import { cn } from '@/lib/utils'

const GRID_COLS = 'md:grid-cols-[3rem_1fr_8rem_5rem_10rem]'

export const Route = createFileRoute('/rounds/$id')({
  beforeLoad: requireAuth,
  component: RoundDetailScreen,
})

function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

// What the best-score cell shows (#206): the team's score over the maximum it
// was judged against — the stamped one, never the points column beside it,
// which the organizer may change once the round closes (#421) — "no
// submissions" when the caller has a team that never submitted the problem, or
// "—" when there is no team best to speak of (no team, organizer, or GET
// /teams not answered yet / failed).
type BestScoreState = 'score' | 'none' | 'unavailable'

type TeamBest = Awaited<ReturnType<typeof fetchRound>>['problems'][number]['bestSubmission']

function bestScoreState(best: TeamBest, hasTeam: boolean): BestScoreState {
  if (best !== null) return 'score'
  return hasTeam ? 'none' : 'unavailable'
}

function RoundDetailScreen() {
  const { t, i18n } = useTranslation()
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)

  // A blunt refetch on any round.opened/round.closed, same pattern index.tsx
  // uses — the live countdown below already updates from the pushed event
  // without this. Reads the app's single `/sse` connection rather than opening
  // a second one for this screen (#274); the ref starts at the provider's
  // current value so mounting mid-round does not invalidate on first render.
  const eventStream = useRoundStream()
  const lastRoundChangeRef = useRef(eventStream.roundChangedAt)
  useEffect(() => {
    if (eventStream.roundChangedAt === lastRoundChangeRef.current) return
    lastRoundChangeRef.current = eventStream.roundChangedAt
    queryClient.invalidateQueries({ queryKey: roundQueryKey(id) })
  }, [eventStream.roundChangedAt, queryClient, id])

  const round = useQuery({
    queryKey: [...roundQueryKey(id), locale],
    queryFn: () => fetchRound(id, locale),
  })

  // Only decorates the best-score cell: whether the caller has a team decides
  // "no submissions" vs "—". A failure never becomes an error state here.
  const teams = useQuery({ queryKey: TEAMS_QUERY_KEY, queryFn: fetchTeams, retry: false })
  const hasTeam = Boolean(teams.data?.myTeamId)

  // Shows the "just closed" notice the instant the query's own status flips
  // open -> closed while mounted, never on a cold load of an already-closed
  // round.
  const [justClosedVisible, setJustClosedVisible] = useState(false)
  const previousStatusRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (previousStatusRef.current === 'open' && round.data?.status === 'closed') {
      setJustClosedVisible(true)
    }
    previousStatusRef.current = round.data?.status
  }, [round.data?.status])

  if (round.isError) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
        {round.error instanceof RoundNotFoundError ? (
          <Alert variant="destructive" data-testid="round-detail-not-found">
            <SearchX />
            <AlertTitle>{t('roundDetail.notFound.alertTitle')}</AlertTitle>
            <AlertDescription>
              <p>{t('roundDetail.notFound.title')}</p>
              <Link to="/" className="text-primary text-sm underline">
                {t('roundDetail.notFound.backHome')}
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive" data-testid="round-detail-load-error">
            <TriangleAlert />
            <AlertTitle>{t('roundDetail.loadError.alertTitle')}</AlertTitle>
            <AlertDescription>
              <p>{t('roundDetail.loadError.message')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="round-detail-load-retry"
                onClick={() => round.refetch()}
              >
                {t('roundDetail.loadError.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </main>
    )
  }

  if (round.isPending) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-start gap-4 p-8">
        <span className="font-display text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          {t('roundDetail.heading')}
        </span>
        <div data-testid="round-detail-loading" className="flex w-full flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t('roundDetail.waiting')}</p>
          <div className="h-9 w-1/3 animate-pulse rounded-md bg-background-2" />
          <div className="h-16 w-full animate-pulse rounded-md bg-background-2" />
          <div className="h-16 w-full animate-pulse rounded-md bg-background-2" />
        </div>
      </main>
    )
  }

  const showCountdown = eventStream.currentRoundId === id && round.data.status === 'open'
  const closesAt =
    eventStream.closesAt ?? (round.data.closesAt ? new Date(round.data.closesAt) : null)
  const serverTimeOffsetMs = eventStream.serverTime
    ? eventStream.serverTime.getTime() - Date.now()
    : 0

  return (
    <main className="mx-auto flex max-w-4xl flex-col items-start gap-4 p-8">
      {/* 'error' is as disconnected as 'reconnecting' (#189) — a rejected
          /sse or the retry cap run out. This screen has no REST fallback, so
          this alert is the only warning that the countdown and the ranking
          have stopped moving. */}
      {(eventStream.status === 'reconnecting' || eventStream.status === 'error') && (
        <Alert variant="warning" data-testid="round-connection-status">
          <WifiOff />
          <AlertDescription>{t('roundDetail.connection.reconnecting')}</AlertDescription>
        </Alert>
      )}

      {justClosedVisible && (
        <Alert data-testid="round-just-closed-notice" className="w-full">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{t('roundDetail.justClosed.message')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJustClosedVisible(false)}
            >
              {t('roundDetail.justClosed.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex w-full flex-col gap-1">
        <span className="font-display text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          {t('roundDetail.heading')}
        </span>
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="font-display font-bold text-4xl">{round.data.name}</h1>
          <Badge
            data-testid="round-detail-status-badge"
            variant="outline"
            className={cn(
              'gap-1.5',
              round.data.status === 'open' && 'border-brand text-brand-text',
            )}
          >
            {round.data.status === 'open' && (
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand" />
            )}
            {t(`roundDetail.status.${round.data.status}`)}
          </Badge>
        </div>
      </div>

      {round.data.status === 'open'
        ? showCountdown &&
          closesAt && (
            <RoundCountdown
              closesAt={closesAt}
              serverTimeOffsetMs={serverTimeOffsetMs}
              roundName={round.data.name}
              className="font-display font-semibold text-brand-text tabular-nums"
            />
          )
        : round.data.closedAt && (
            <span data-testid="round-detail-closed-at" className="text-muted-foreground text-sm">
              {t('roundDetail.closedAt', {
                time: formatTime(new Date(round.data.closedAt), locale),
              })}
            </span>
          )}

      {round.data.problems.length === 0 ? (
        <div
          data-testid="round-detail-empty"
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border p-10 text-center"
        >
          <p className="text-muted-foreground text-sm">{t('roundDetail.emptyProblems')}</p>
        </div>
      ) : (
        <div role="table" data-testid="round-problems-table" className="w-full">
          <div
            role="row"
            className={cn(
              'hidden border-b pb-2 text-muted-foreground text-xs uppercase tracking-wide',
              'md:grid md:gap-4',
              GRID_COLS,
            )}
          >
            <span role="columnheader">{t('roundDetail.columns.position')}</span>
            <span role="columnheader">{t('roundDetail.columns.title')}</span>
            <span role="columnheader">{t('roundDetail.columns.difficulty')}</span>
            <span role="columnheader">{t('roundDetail.columns.points')}</span>
            <span role="columnheader">{t('roundDetail.columns.bestScore')}</span>
          </div>
          <div className="flex flex-col gap-3 md:gap-0">
            {round.data.problems
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((problem) => (
                <div
                  key={problem.problemId}
                  role="row"
                  data-testid={`round-problem-${problem.problemId}`}
                  className={cn(
                    'relative flex flex-col gap-1 rounded-xl border p-4',
                    'md:grid md:items-center md:gap-4 md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:p-3',
                    GRID_COLS,
                  )}
                >
                  <span role="cell" className="font-display text-lg md:text-base">
                    <span className="sr-only md:hidden">{t('roundDetail.columns.position')}: </span>
                    {positionLabel(problem.position)}
                  </span>
                  <span role="cell" className="font-medium">
                    <Link
                      to="/problem/$id"
                      params={{ id: problem.problemId }}
                      className="after:absolute after:inset-0"
                    >
                      {problem.title}
                    </Link>
                  </span>
                  <span role="cell">
                    <span className="sr-only md:hidden">
                      {t('roundDetail.columns.difficulty')}:{' '}
                    </span>
                    <Badge
                      variant={DIFFICULTY_BADGE_STYLE[problem.difficulty].variant}
                      className={DIFFICULTY_BADGE_STYLE[problem.difficulty].className}
                    >
                      {t(`roundDetail.difficulty.${problem.difficulty}`)}
                    </Badge>
                  </span>
                  <span
                    role="cell"
                    data-testid={`round-problem-points-${problem.problemId}`}
                    className="tabular-nums"
                  >
                    <span className="sr-only md:hidden">{t('roundDetail.columns.points')}: </span>
                    {problem.points}
                  </span>
                  <BestScoreCell
                    problemId={problem.problemId}
                    best={problem.bestSubmission}
                    hasTeam={hasTeam}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </main>
  )
}

function BestScoreCell({
  problemId,
  best,
  hasTeam,
}: {
  problemId: string
  best: TeamBest
  hasTeam: boolean
}) {
  const { t } = useTranslation()
  const state = bestScoreState(best, hasTeam)
  return (
    <span
      role="cell"
      data-testid={`round-problem-best-score-${problemId}`}
      data-state={state}
      className={cn('tabular-nums', state !== 'score' && 'text-muted-foreground')}
    >
      <span className="sr-only md:hidden">{t('roundDetail.columns.bestScore')}: </span>
      {best !== null
        ? t('roundDetail.bestScore.score', { score: best.score, maxScore: best.maxScore })
        : state === 'none'
          ? t('roundDetail.bestScore.none')
          : t('roundDetail.bestScore.unavailable')}
    </span>
  )
}
