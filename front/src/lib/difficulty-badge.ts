export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * How a difficulty reads as a badge, per identity.md § 5: "Fácil verde / Médio
 * âmbar-texto / Difícil crimson, contorno".
 *
 * `medium` is `warning`, which is `border-warning` + `text-warning-text` — pure
 * amber (`--warning`) as *text* is 1,95:1 and never serves as text. `hard` is
 * the crimson outline spelled out on top of `outline`, so it stays a hairline
 * badge rather than the filled plate § 5 forbids.
 *
 * It lives here rather than in `/rounds/$id`, its first consumer: a plain
 * `export` from a TanStack route file drops that route out of the build's
 * code-splitting, and the chunk disappears from `dist` with no warning.
 */
export const DIFFICULTY_BADGE_STYLE: Record<
  Difficulty,
  { variant: 'success' | 'warning' | 'outline'; className?: string }
> = {
  easy: { variant: 'success' },
  medium: { variant: 'warning' },
  hard: { variant: 'outline', className: 'border-destructive text-destructive' },
}
