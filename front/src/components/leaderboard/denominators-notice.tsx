import { Info, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { DenominatorVerdict } from '@/lib/sse-schema'

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
