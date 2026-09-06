import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RoundCountdown } from '@/components/round-countdown'
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
import { useEventStream } from '@/hooks/use-event-stream'
import { fetchRound, RoundNotFoundError, roundQueryKey } from '@/lib/rounds-query'
import { requireAuth } from '@/lib/route-guards'

export const Route = createFileRoute('/rounds/$id')({
  beforeLoad: requireAuth,
  component: RoundDetailScreen,
})

function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

function RoundDetailScreen() {
  const { t, i18n } = useTranslation()
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)

  // A blunt refetch on any round.opened/round.closed, same pattern index.tsx
  // uses — the live countdown below already updates from the pushed event
  // without this.
  const eventStream = useEventStream(() =>
    queryClient.invalidateQueries({ queryKey: roundQueryKey(id) }),
  )

  const round = useQuery({
    queryKey: [...roundQueryKey(id), locale],
    queryFn: () => fetchRound(id, locale),
  })

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
          <div data-testid="round-detail-not-found" className="flex flex-col items-start gap-2">
            <p>{t('roundDetail.notFound.title')}</p>
            <Link to="/" className="text-primary text-sm underline">
              {t('roundDetail.notFound.backHome')}
            </Link>
          </div>
        ) : (
          <div data-testid="round-detail-load-error" className="flex flex-col items-start gap-2">
            <p>{t('roundDetail.loadError.message')}</p>
            <Button
              type="button"
              variant="outline"
              data-testid="round-detail-load-retry"
              onClick={() => round.refetch()}
            >
              {t('roundDetail.loadError.retry')}
            </Button>
          </div>
        )}
      </main>
    )
  }

  if (round.isPending) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
        <p data-testid="round-detail-loading">{t('roundDetail.waiting')}</p>
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
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
      {eventStream.status === 'reconnecting' && (
        <Alert data-testid="round-connection-status">
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

      <div className="flex w-full items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">{round.data.name}</h1>
        <Badge data-testid="round-detail-status-badge">
          {t(`roundDetail.status.${round.data.status}`)}
        </Badge>
      </div>

      {showCountdown && closesAt && (
        <RoundCountdown closesAt={closesAt} serverTimeOffsetMs={serverTimeOffsetMs} />
      )}

      {round.data.problems.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('roundDetail.emptyProblems')}</p>
      ) : (
        <Table data-testid="round-problems-table" className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>{t('roundDetail.columns.title')}</TableHead>
              <TableHead>{t('roundDetail.columns.difficulty')}</TableHead>
              <TableHead>{t('roundDetail.columns.points')}</TableHead>
              <TableHead>{t('roundDetail.columns.bestScore')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {round.data.problems.map((problem) => (
              <TableRow key={problem.problemId} data-testid={`round-problem-${problem.problemId}`}>
                <TableCell>{problem.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {t(`roundDetail.difficulty.${problem.difficulty}`)}
                  </Badge>
                </TableCell>
                <TableCell>{problem.points}</TableCell>
                <TableCell>{problem.bestScore ?? t('roundDetail.bestScore.hidden')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  )
}
