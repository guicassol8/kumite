import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownPreview } from '@/components/markdown-preview'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DIFFICULTY_BADGE_STYLE } from '@/lib/difficulty-badge'
import type { fetchProblem } from '@/lib/problems-query'
import { cn } from '@/lib/utils'

type Problem = Awaited<ReturnType<typeof fetchProblem>>

/**
 * The team's best score on this problem while the round is open (#206):
 * `score` once it submitted, `none` when it has a team that never did.
 * Absent means there is no team best to speak of (no team, or the round is
 * closed, where the closed notice already carries it) — no badge then.
 *
 * `maxScore` is the maximum *that* score was computed against — the stamp on
 * the submission (#319) — not the problem's points of now, which the "N pts"
 * badge shows and which may have changed since.
 */
export type TeamBestScore = { kind: 'score'; score: number; maxScore: number } | { kind: 'none' }

export type StatementCardProps = {
  problem: Problem
  hasResults: boolean
  /**
   * The problem's letter in the round it was opened from (A, B, C…). Absent
   * outside a round: `/problems/:id` carries no `position`, so the letter only
   * exists when `/rounds/:id` could be read alongside it (#219, T4).
   */
  positionLabel?: string
  /**
   * The desktop resizable-panels layout (#203) already constrains this
   * card's box from the outside — the stacked-layout width/height clamps
   * below would otherwise fight the panel for its own size.
   */
  fitContainer?: boolean
  /**
   * Rendered next to the title: the desktop layout's collapse button, or the
   * phone's fold toggle (#199). Always the header's last child, collapsed or
   * not, so React keeps the very same node — and the focus on it — across
   * the switch.
   */
  headerAction?: ReactNode
  bestScore?: TeamBestScore
  /**
   * The phone's folded strip (#199): the letter, the title and the header
   * action, nothing else — no badges, no body, and none of the stacked
   * height clamps, which only bound a card with a body to scroll.
   */
  collapsed?: boolean
}

/** `undefined` has no JSON form, and an example may legitimately expect it. */
function formatValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value)
}

/** The problem statement and its examples — extracted verbatim from `/problem/$id` (#203). */
export function StatementCard({
  problem,
  hasResults,
  positionLabel,
  fitContainer,
  headerAction,
  bestScore,
  collapsed,
}: StatementCardProps) {
  const { t } = useTranslation()
  const difficulty = DIFFICULTY_BADGE_STYLE[problem.difficulty]
  const positionBadge = positionLabel && (
    <Badge
      data-testid="problem-position-badge"
      variant="outline"
      className={collapsed ? 'shrink-0' : undefined}
    >
      {t('problem.positionBadge', { letter: positionLabel })}
    </Badge>
  )

  return (
    <Card
      data-testid="problem-statement-panel"
      aria-label={t('problem.statementLabel')}
      className={cn(
        fitContainer
          ? 'h-full max-h-none w-full overflow-auto'
          : collapsed
            ? // A fixed strip (≤ 64px with the 44px toggle): it never
              // shrinks under the column's pressure, or the toggle that
              // brings the statement back would be the first thing cut.
              'shrink-0 gap-0 overflow-hidden py-2'
            : [
                'overflow-auto md:max-h-none md:w-96 md:shrink-0',
                // Stacked layout only: the side column on md+ owns a whole
                // column and never competes with the band for height. On a
                // short phone it gives up a second slice, because the band
                // has nowhere else to take height from.
                hasResults ? 'max-h-36 short:max-h-20' : 'max-h-64',
              ],
      )}
    >
      <CardHeader
        className={cn(
          headerAction && 'flex-row items-start justify-between gap-2',
          collapsed && 'items-center px-4',
        )}
      >
        {collapsed ? (
          <div className="flex min-w-0 items-center gap-2">
            {positionBadge}
            <CardTitle className="truncate font-bold font-display text-lg leading-tight">
              {problem.title}
            </CardTitle>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                data-testid="problem-difficulty-badge"
                variant={difficulty.variant}
                className={difficulty.className}
              >
                {t(`problem.difficulty.${problem.difficulty}`)}
              </Badge>
              {/* Practice does not score (#211): "N pts" there would promise
                points that never land anywhere. */}
              {problem.visibility !== 'practice' && (
                <Badge data-testid="problem-points-badge" variant="secondary">
                  {t('problem.pointsBadge', { points: problem.points })}
                </Badge>
              )}
              {positionBadge}
              {bestScore?.kind === 'score' && (
                <Badge data-testid="problem-best-score-badge" variant="outline">
                  {t('problem.bestScoreBadge', {
                    score: bestScore.score,
                    maxScore: bestScore.maxScore,
                  })}
                </Badge>
              )}
              {bestScore?.kind === 'none' && (
                <Badge
                  data-testid="problem-no-submission-badge"
                  variant="outline"
                  className="text-muted-foreground"
                >
                  {t('problem.noSubmissionBadge')}
                </Badge>
              )}
            </div>
            <CardTitle className="font-bold font-display text-2xl">{problem.title}</CardTitle>
          </div>
        )}
        {headerAction}
      </CardHeader>
      {!collapsed && (
        <CardContent className="flex flex-col gap-4 text-sm">
          <MarkdownPreview data-testid="problem-statement-body" value={problem.statementMd} />
          <div>
            <h2 className="mb-2 font-display font-semibold text-[13px] text-muted-foreground uppercase tracking-[0.12em]">
              {t('problem.examplesHeading')}
            </h2>
            <ul className="flex flex-col gap-2">
              {problem.examples.map((example, index) => (
                <li
                  key={index}
                  data-testid={`problem-example-${index}`}
                  className="rounded-md border p-2 font-mono text-xs"
                >
                  {/* The labels the pre-#219 card printed inline survive as the
                    accessible reading of the arrow: identity § 3 does not let
                    a glyph be the only carrier of meaning. */}
                  <span className="sr-only">{t('problem.exampleInput')}: </span>
                  <span>{formatValue(example.input)}</span>
                  <span aria-hidden="true" className="px-1.5 text-brand-text">
                    →
                  </span>
                  <span className="sr-only">{t('problem.exampleOutput')}: </span>
                  <span className="text-brand-text">{formatValue(example.expected)}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
