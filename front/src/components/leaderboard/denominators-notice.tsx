import { Info, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatList } from '@/i18n/format'
import type { DenominatorVerdict, EventRankingRoundVerdict } from '@/lib/sse-schema'

// Surfaces the round ranking's comparability verdict (#193) to the organizer
// (#318). `inconsistent` means the same problem was scored against more than
// one denominator inside the round, so the teams' totals cannot be compared:
// that is the loud warning. `unknown` only means some counted submission
// predates the scale stamp — consistency cannot be asserted either way — so
// it gets a quiet note (`role="note"`, not an assertive alert). `consistent`
// adds nothing to the screen.
export function DenominatorsNotice({ verdict }: { verdict: DenominatorVerdict }) {
  const { t } = useTranslation()

  if (verdict === 'inconsistent') {
    return (
      <Alert variant="warning" data-testid="leaderboard-denominators-inconsistent">
        <TriangleAlert />
        {/* The title IS the message: never clip it to one line on a phone. */}
        <AlertTitle className="line-clamp-none">
          {t('leaderboard.denominators.inconsistent.title')}
        </AlertTitle>
        <AlertDescription>
          {t('leaderboard.denominators.inconsistent.description')}
        </AlertDescription>
      </Alert>
    )
  }

  if (verdict === 'unknown') {
    return (
      <Alert role="note" data-testid="leaderboard-denominators-unknown">
        <Info />
        <AlertDescription>{t('leaderboard.denominators.unknown.description')}</AlertDescription>
      </Alert>
    )
  }

  return null
}

// The Geral tab's counterpart (#383): the event total sums every announced
// round, so one round that is not on a single scale makes the total not
// comparable either. Same shape as DenominatorsNotice, one level up:
// `inconsistent` wins over `unknown` and names only the rounds that proved
// it, in column order; `unknown` gets the quiet note and names nothing (it
// cannot point at a culprit); all `consistent` (or no round yet) adds nothing.
export function EventDenominatorsNotice({ rounds }: { rounds: EventRankingRoundVerdict[] }) {
  const { t, i18n } = useTranslation()

  const inconsistent = rounds.filter((round) => round.denominators === 'inconsistent')
  if (inconsistent.length > 0) {
    const names = inconsistent.map((round) => round.roundName)
    const lang = i18n.resolvedLanguage ?? i18n.language
    return (
      <Alert variant="warning" data-testid="leaderboard-event-denominators-inconsistent">
        <TriangleAlert />
        {/* The title IS the message: never clip it to one line on a phone. */}
        <AlertTitle className="line-clamp-none">
          {t('leaderboard.eventDenominators.inconsistent.title')}
        </AlertTitle>
        <AlertDescription>
          {t('leaderboard.eventDenominators.inconsistent.description', {
            count: names.length,
            rounds: formatList(names, lang),
          })}
        </AlertDescription>
      </Alert>
    )
  }

  if (rounds.some((round) => round.denominators === 'unknown')) {
    return (
      <Alert role="note" data-testid="leaderboard-event-denominators-unknown">
        <Info />
        <AlertDescription>
          {t('leaderboard.eventDenominators.unknown.description')}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
