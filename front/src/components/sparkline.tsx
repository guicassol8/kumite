import { cn } from '@/lib/utils'

// A fixed drawing box stretched to the container (preserveAspectRatio="none"),
// so the line fills whatever width the card gives it. The stroke opts out of
// that stretch (non-scaling-stroke) and the vertical padding keeps it from
// being clipped at the peak and at the baseline.
const WIDTH = 100
const HEIGHT = 32
const PAD_Y = 2

type SparklineProps = {
  values: number[]
  /** Accessible name — the line itself carries no text. */
  label: string
  testId?: string
  className?: string
}

/**
 * A bare trend line: no axes, no ticks, no dots. The numbers it summarizes are
 * printed next to it, so this only has to show the shape (#279).
 */
export function Sparkline({ values, label, testId, className }: SparklineProps) {
  // Floor of 1 so an all-zero series is a flat line on the baseline, not a
  // division by zero.
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0
  const points = values
    .map((value, index) => {
      const x = index * step
      const y = HEIGHT - PAD_Y - (value / max) * (HEIGHT - 2 * PAD_Y)
      return `${round(x)},${round(y)}`
    })
    .join(' ')

  return (
    <svg
      role="img"
      aria-label={label}
      data-testid={testId}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('h-8 w-full text-brand-text', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
