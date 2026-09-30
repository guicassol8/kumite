import { Minimize2, PartyPopper, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfettiBurst } from '@/components/leaderboard/confetti-burst'
import { type University, UniversityBadge } from '@/components/teams/university-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTelaoSession } from '@/hooks/use-telao-session'
import { selectPodium } from '@/lib/podium'
import { displayTeamName } from '@/lib/team-name'
import { cn } from '@/lib/utils'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** Each step of the entry: 3rd, 2nd, 1st, then the list and the invite. */
const ENTRY_STEP_S = 0.6

export type PodiumTeam = {
  teamId: string
  teamName: string
  rank: number
  totalScore: number
}

export type PodiumMember = { name: string | null; university: University }

export type PodiumStatus = 'loading' | 'error' | 'ready'

// Where each place sits on screen: 2–1–3, the winner in the middle. The DOM
// keeps rank order (1, 2, 3) so a screen reader reads the podium top-down;
// only the grid placement moves them. Fixed columns rather than `order-*`,
// so a podium of one or two keeps the winner in the middle instead of
// sliding into the first free cell.
const PLACE_LAYOUT: Record<number, { column: string; entryStep: number; raise: string }> = {
  1: { column: 'col-start-2', entryStep: 2, raise: 'pb-8' },
  2: { column: 'col-start-1', entryStep: 1, raise: 'pb-4' },
  3: { column: 'col-start-3', entryStep: 0, raise: 'pb-0' },
}

function universitiesOf(members: PodiumMember[]): University[] {
  return [...new Set(members.map((member) => member.university))]
}

/**
 * The closing ceremony on the projector (#284): the event's top three with
 * their members and universities, 4th–10th underneath, and the invite to the
 * next edition. Presentation only — the route fetches, this renders.
 *
 * It is a telão state (identity.md § 5): same forced dark, no chrome, same
 * two exits and focus rules, through the shared `useTelaoSession`. And, like
 * the telão, it never shows the organizer's denominators notices: what is
 * projected is for the whole room.
 *
 * Only teams with points take a place (P1-A, `selectPodium`); only the
 * podium names its members (P3-A), and a member with no name on record (an
 * account from before #122) is left out — an e-mail never reaches the screen.
 */
export function PodiumBoard({
  teams,
  membersByTeam,
  status,
  onRetry,
  onExit,
}: {
  teams: PodiumTeam[]
  membersByTeam: Map<string, PodiumMember[]>
  status: PodiumStatus
  onRetry: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const [confettiBurst, setConfettiBurst] = useState(0)

  useTelaoSession({ onExit, focusRef: exitButtonRef })

  const { podium, rest } = selectPodium(teams)
  const isEmpty = status === 'ready' && podium.length === 0

  // Reduced motion: everything is born in its final state (`initial={false}`),
  // nothing fades or rises.
  function entry(step: number) {
    return prefersReducedMotion
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 32 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: ENTRY_STEP_S,
            delay: step * ENTRY_STEP_S,
            ease: 'easeOut' as const,
          },
        }
  }

  return (
    // No `overflow-hidden` and no `min-h-0` on purpose, unlike the telão
    // (which pages instead): if the ceremony ever outgrows the screen it must
    // show as a scroll the E2E measures, never as a 10th place silently cut
    // off at the bottom edge of the projector.
    <div
      data-testid="podium-board"
      className="flex flex-1 flex-col gap-4 bg-background px-8 py-6 text-foreground"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display font-extrabold text-[84px] uppercase leading-[76px] tracking-[0.01em]">
          {t('leaderboard.podium.title')}
        </h1>
        <div className="flex items-center gap-2">
          {status === 'ready' && !isEmpty && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="podium-confetti-button"
              aria-label={t('leaderboard.podium.confetti')}
              onClick={() => setConfettiBurst((burst) => burst + 1)}
            >
              <PartyPopper className="size-6" />
            </Button>
          )}
          <Button
            ref={exitButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            data-testid="podium-exit-button"
            aria-label={t('leaderboard.telao.exitButton')}
            onClick={onExit}
          >
            <Minimize2 className="size-6" />
          </Button>
        </div>
      </div>

      {status === 'loading' && (
        <div
          data-testid="podium-loading"
          className="grid flex-1 grid-cols-3 items-end gap-8 motion-safe:animate-pulse"
        >
          <div className="h-2/5 rounded-lg bg-background-2" />
          <div className="h-3/5 rounded-lg bg-background-2" />
          <div className="h-1/3 rounded-lg bg-background-2" />
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-1 items-center justify-center">
          <Alert variant="destructive" data-testid="podium-error" className="max-w-2xl text-lg">
            <TriangleAlert />
            <AlertTitle>{t('leaderboard.error.alertTitle')}</AlertTitle>
            <AlertDescription className="text-lg">
              <p>{t('leaderboard.podium.error')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="podium-error-retry"
                onClick={onRetry}
              >
                {t('leaderboard.error.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-1 items-center justify-center">
          <p
            data-testid="podium-empty"
            className="font-display text-[36px] text-muted-foreground leading-tight"
          >
            {t('leaderboard.podium.empty')}
          </p>
        </div>
      )}

      {status === 'ready' && !isEmpty && (
        <div className="flex flex-1 flex-col justify-center">
          <ol
            data-testid="podium-places"
            aria-label={t('leaderboard.podium.title')}
            className="grid grid-cols-3 items-end gap-8"
          >
            {podium.map((team) => {
              const layout = PLACE_LAYOUT[team.rank] ?? PLACE_LAYOUT[3]!
              const members = membersByTeam.get(team.teamId) ?? []
              const named = members
                .map((member) => member.name?.trim() ?? '')
                .filter((name) => name !== '')
              const isWinner = team.rank === 1
              return (
                <motion.li
                  key={team.teamId}
                  data-testid={`podium-place-${team.rank}`}
                  className={cn(
                    'row-start-1 flex min-w-0 flex-col gap-2',
                    layout.column,
                    layout.raise,
                  )}
                  {...entry(layout.entryStep)}
                >
                  <span className="sr-only">
                    {t('leaderboard.podium.placeLabel', { place: team.rank })}
                  </span>
                  {/* Numeral, seals and points share one row: a 1280×800
                      projector (WXGA) has no height to spare for a row of
                      seals of their own under a three-line name. */}
                  <div className="flex items-end gap-4">
                    <span
                      aria-hidden="true"
                      data-testid={`podium-numeral-${team.rank}`}
                      // `leading-none` goes after the size: tailwind-merge
                      // drops a line-height that precedes a font-size (a
                      // `text-*` can set both), and the numeral would
                      // silently take 1.5× its height.
                      className={cn(
                        'font-display font-extrabold tabular-nums',
                        isWinner
                          ? 'text-[96px] text-brand-text 2xl:text-[120px]'
                          : 'text-[72px] text-foreground 2xl:text-[88px]',
                        'leading-none',
                      )}
                    >
                      {team.rank}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2 pb-2">
                      {universitiesOf(members).map((university) => (
                        <UniversityBadge
                          key={university}
                          university={university}
                          className="px-2.5 py-1 text-[20px]"
                        />
                      ))}
                    </div>
                    <span
                      data-testid={`podium-points-${team.rank}`}
                      className="shrink-0 pb-2 font-display font-semibold text-[28px] tabular-nums 2xl:text-[32px]"
                    >
                      {t('leaderboard.podium.points', { count: team.totalScore })}
                    </span>
                  </div>
                  {/* Three lines hold the longest name the back accepts (40
                      characters) at these sizes, so the clamp never cuts a
                      real one; `wrap-anywhere` covers a name with no spaces. */}
                  <span
                    data-testid={`podium-team-name-${team.rank}`}
                    className={cn(
                      'line-clamp-3 wrap-anywhere font-bold font-display',
                      isWinner ? 'text-[56px] 2xl:text-[72px]' : 'text-[48px] 2xl:text-[56px]',
                      'leading-none',
                    )}
                  >
                    {displayTeamName(team.teamName, t('teams.unnamed'))}
                  </span>
                  {named.length > 0 && (
                    <ul
                      data-testid={`podium-members-${team.rank}`}
                      className={cn(
                        'text-[28px] leading-tight 2xl:text-[32px]',
                        named.length > 3 ? 'grid grid-cols-2 gap-x-4' : 'flex flex-col',
                      )}
                    >
                      {named.map((name, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: two members may share a name
                        <li key={index} className="truncate">
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.li>
              )
            })}
          </ol>
        </div>
      )}

      {status === 'ready' && !isEmpty && rest.length > 0 && (
        <motion.ol
          data-testid="podium-rest"
          start={rest[0]?.rank}
          className="grid gap-x-12 gap-y-1 border-border border-t pt-4 xl:grid-flow-col xl:grid-cols-2 xl:grid-rows-4"
          {...entry(3)}
        >
          {rest.map((team) => {
            const members = membersByTeam.get(team.teamId) ?? []
            return (
              <li
                key={team.teamId}
                data-testid={`podium-rest-row-${team.rank}`}
                className="flex min-w-0 items-center gap-4 text-[28px] leading-tight"
              >
                <span className="sr-only">
                  {t('leaderboard.podium.placeLabel', { place: team.rank })}
                </span>
                <span
                  aria-hidden="true"
                  className="w-12 shrink-0 font-display font-bold text-muted-foreground tabular-nums"
                >
                  {team.rank}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {displayTeamName(team.teamName, t('teams.unnamed'))}
                </span>
                {universitiesOf(members).map((university) => (
                  <UniversityBadge
                    key={university}
                    university={university}
                    className="shrink-0 px-2 text-[20px]"
                  />
                ))}
                <span className="shrink-0 font-bold tabular-nums">{team.totalScore}</span>
              </li>
            )
          })}
        </motion.ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-1">
        {status === 'ready' ? (
          <motion.p
            data-testid="podium-invite"
            className="font-display font-semibold text-[32px] leading-tight"
            {...entry(3)}
          >
            {t('leaderboard.podium.invite')}
          </motion.p>
        ) : (
          <span />
        )}
        <span data-testid="podium-exit-hint" className="shrink-0 text-lg text-muted-foreground">
          {t('leaderboard.podium.exitHint')}
        </span>
      </div>

      <ConfettiBurst trigger={confettiBurst} />
    </div>
  )
}
