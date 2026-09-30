import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export const CONFETTI_PIECES = 80
const FALL_MIN_S = 2.5
const FALL_MAX_S = 4
const MAX_DELAY_S = 0.6
/** The longest piece's delay plus its fall, and a margin: then the layer goes. */
export const CONFETTI_LIFETIME_MS = (MAX_DELAY_S + FALL_MAX_S) * 1000 + 200
/** Reduced motion: the pieces just sit there, spread out, and then vanish. */
export const CONFETTI_STILL_LIFETIME_MS = 3000

// Tokens only (identity.md § 3): the brand red, the paper of the forced dark
// theme, and amber — which is never text or a lone icon, but a fill is
// exactly the use § 3 allows it.
const COLORS = ['bg-brand', 'bg-foreground', 'bg-warning'] as const
const SIZES = ['h-3 w-2', 'h-4 w-2.5', 'h-5 w-3'] as const

type Piece = {
  color: (typeof COLORS)[number]
  size: (typeof SIZES)[number]
  /** Horizontal start, in vw. */
  x: number
  /** Sideways drift over the fall, in vw. */
  drift: number
  /** Where the piece rests when motion is reduced, in vh. */
  restY: number
  rotate: number
  duration: number
  delay: number
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function makePieces(): Piece[] {
  return Array.from({ length: CONFETTI_PIECES }, (_, index) => ({
    color: COLORS[index % COLORS.length]!,
    size: SIZES[Math.floor(Math.random() * SIZES.length)]!,
    x: between(0, 100),
    drift: between(-10, 10),
    restY: between(5, 95),
    rotate: between(360, 1080) * (Math.random() < 0.5 ? -1 : 1),
    duration: between(FALL_MIN_S, FALL_MAX_S),
    delay: between(0, MAX_DELAY_S),
  }))
}

/**
 * A burst of confetti over the whole screen, fired by the organizer on the
 * pódio (#284). Every change of `trigger` (anything but 0) starts a fresh
 * burst — a new `key` remounts the layer, so two clicks in a row never stack
 * two layers — and the layer unmounts itself once the last piece has landed.
 *
 * Built on `motion`, already in the bundle, instead of a confetti library (a
 * new dependency would touch the protected lockfile). With
 * `prefers-reduced-motion` the pieces are born already spread out, with no
 * fall and no spin (`initial={false}`), and disappear after ~3 s with no
 * transition.
 */
export function ConfettiBurst({ trigger }: { trigger: number }) {
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const [activeBurst, setActiveBurst] = useState<number | null>(null)

  useEffect(() => {
    if (trigger === 0) return
    setActiveBurst(trigger)
    const timer = setTimeout(
      () => setActiveBurst(null),
      prefersReducedMotion ? CONFETTI_STILL_LIFETIME_MS : CONFETTI_LIFETIME_MS,
    )
    return () => clearTimeout(timer)
  }, [trigger, prefersReducedMotion])

  // One fresh scatter per burst: `activeBurst` is what changes between them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-rolled per burst on purpose
  const pieces = useMemo(makePieces, [activeBurst])

  if (activeBurst === null) return null

  return (
    <div
      key={activeBurst}
      aria-hidden="true"
      data-testid="podium-confetti"
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((piece, index) => (
        <motion.span
          // biome-ignore lint/suspicious/noArrayIndexKey: a burst's pieces never reorder
          key={index}
          data-testid="podium-confetti-piece"
          className={cn('absolute top-0 left-0 rounded-[1px]', piece.color, piece.size)}
          initial={prefersReducedMotion ? false : { x: `${piece.x}vw`, y: '-10vh', rotate: 0 }}
          animate={
            prefersReducedMotion
              ? { x: `${piece.x}vw`, y: `${piece.restY}vh`, rotate: piece.rotate % 180 }
              : { x: `${piece.x + piece.drift}vw`, y: '110vh', rotate: piece.rotate }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: piece.duration, delay: piece.delay, ease: 'easeIn' }
          }
        />
      ))}
    </div>
  )
}
