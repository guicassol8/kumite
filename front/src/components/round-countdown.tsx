import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

function formatRemaining(ms: number): string {
  const clamped = Math.max(0, ms)
  const totalSeconds = Math.floor(clamped / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

// `serverTimeOffsetMs` (server time minus client time, from the SSE
// `serverTime` field) corrects for client/server clock skew so the
// countdown agrees with the deadline the backend actually enforces.
export function RoundCountdown({
  closesAt,
  serverTimeOffsetMs,
  className,
  roundName,
}: {
  closesAt: Date
  serverTimeOffsetMs: number
  className?: string
  roundName?: string
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remainingMs = closesAt.getTime() - (now + serverTimeOffsetMs)
  const remainingMinutes = Math.ceil(Math.max(0, remainingMs) / 60_000)

  return (
    <>
      <span data-testid="round-countdown" aria-live="off" className={cn(className)}>
        {t('home.round.timeRemaining', { time: formatRemaining(remainingMs) })}
      </span>
      <span data-testid="round-countdown-summary" className="sr-only">
        {roundName
          ? t('roundCountdown.summary', { name: roundName, count: remainingMinutes })
          : t('roundCountdown.summaryNoName', { count: remainingMinutes })}
      </span>
    </>
  )
}
