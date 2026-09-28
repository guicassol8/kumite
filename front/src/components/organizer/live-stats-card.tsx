import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Sparkline } from '@/components/sparkline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchOrganizerLiveStats, ORGANIZER_LIVE_STATS_QUERY_KEY } from '@/lib/live-stats-query'

import { CARD_TITLE, DETAIL, STAT } from './overview-styles'

const LIVE_STATS_POLL_MS = 5_000

/**
 * The organizer's live card (#279): judge queue, open SSE streams and
 * accepted submissions, straight from the API process's memory. It answers
 * "is it slow because the judge is stuck or because the network dropped?" —
 * so it keeps its own query and renders even when the event numbers above it
 * fail to load.
 */
export function LiveStatsCard() {
  const { t } = useTranslation()
  const live = useQuery({
    queryKey: ORGANIZER_LIVE_STATS_QUERY_KEY,
    queryFn: fetchOrganizerLiveStats,
    refetchInterval: LIVE_STATS_POLL_MS,
    // The default, spelled out because it is the acceptance criterion: a
    // hidden tab stops polling, and coming back refetches at once.
    refetchIntervalInBackground: false,
  })

  return (
    <Card data-testid="overview-live-card">
      <CardHeader>
        <CardTitle className={CARD_TITLE}>{t('organizer.overview.live.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {live.isPending && (
          <p className={DETAIL} data-testid="overview-live-loading">
            {t('organizer.overview.live.loading')}
          </p>
        )}

        {live.data && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <span className={DETAIL}>{t('organizer.overview.live.judge.label')}</span>
              <span className={STAT} data-testid="overview-live-judge-in-flight">
                {live.data.judge.inFlight}
              </span>
              <span className={DETAIL} data-testid="overview-live-judge-waiting">
                {t('organizer.overview.live.judge.waiting', { count: live.data.judge.waiting })}
              </span>
              <span className={DETAIL} data-testid="overview-live-judge-concurrency">
                {t('organizer.overview.live.judge.concurrency', {
                  count: live.data.judge.concurrency,
                })}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className={DETAIL}>{t('organizer.overview.live.sse.label')}</span>
              <span className={STAT} data-testid="overview-live-sse-connections">
                {live.data.sse.connections}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className={DETAIL}>{t('organizer.overview.live.submissions.label')}</span>
              <span className={STAT} data-testid="overview-live-submissions-last-minute">
                {live.data.submissions.lastMinute}
              </span>
              <span className={DETAIL} data-testid="overview-live-submissions-in-flight">
                {t('organizer.overview.live.submissions.inFlight', {
                  count: live.data.submissions.inFlight,
                })}
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <span className={DETAIL}>{t('organizer.overview.live.trend.label')}</span>
              <Sparkline
                values={live.data.submissions.perMinute}
                label={t('organizer.overview.live.trend.ariaLabel')}
                testId="overview-live-sparkline"
                className="h-11"
              />
            </div>
          </div>
        )}

        {/* Kept alongside the last numbers rather than replacing them: a
            failing poll is itself the answer to "did the network drop?". */}
        {live.isError && (
          <p className="text-destructive text-sm" data-testid="overview-live-error">
            {t('organizer.overview.live.error')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
