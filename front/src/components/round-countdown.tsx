import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
}: {
  closesAt: Date
  serverTimeOffsetMs: number
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remainingMs = closesAt.getTime() - (now + serverTimeOffsetMs)

  return (
    <span data-testid="round-countdown">
      {t('home.round.timeRemaining', { time: formatRemaining(remainingMs) })}
    </span>
  )
}
