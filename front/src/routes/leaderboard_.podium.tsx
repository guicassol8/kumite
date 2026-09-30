import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'

import {
  PodiumBoard,
  type PodiumMember,
  type PodiumStatus,
} from '@/components/leaderboard/podium-board'
import { fetchOrganizerTeams, ORGANIZER_TEAMS_QUERY_KEY } from '@/lib/organizer-teams-query'
import { fetchEventRanking } from '@/lib/ranking-query'
import { requireRole } from '@/lib/route-guards'

// `leaderboard_` (trailing underscore) takes this route out of /leaderboard's
// nesting while keeping the URL /leaderboard/podium: the leaderboard screen
// renders no <Outlet />, so a nested child would never show (#284).
export const Route = createFileRoute('/leaderboard_/podium')({
  beforeLoad: requireRole('organizer'),
  component: PodiumScreen,
})

// The closing ceremony (#284). Read once when it opens, no live updates: it
// runs after the last round, and opening it with a round still open is the
// organizer's call — the ranking so far is shown as is.
function PodiumScreen() {
  const navigate = Route.useNavigate()

  // Same cache entry as the leaderboard's REST fallback, but never painted
  // from it: the board fills that entry once, when /leaderboard loads, and
  // leaves it alone while the stream is live, so by the ceremony it can be
  // hours old. Only a ranking fetched since this screen opened takes the
  // stage (`status` below); `refetchOnMount: 'always'` guarantees that fetch
  // even if a default `staleTime` ever says the cached one is still fresh.
  const [openedAt] = useState(Date.now)
  const ranking = useQuery({
    queryKey: ['ranking', 'event'],
    queryFn: fetchEventRanking,
    refetchOnMount: 'always',
  })
  const rankingIsCurrent = ranking.data !== undefined && ranking.dataUpdatedAt >= openedAt
  // Members come from the organizer's moderation listing: GET /teams only
  // names the viewer's own team, and would give every other member as null.
  const teams = useQuery({ queryKey: ORGANIZER_TEAMS_QUERY_KEY, queryFn: fetchOrganizerTeams })

  // Only what the board may show goes in: name and university. The listing
  // also carries each member's e-mail, which never reaches the projector.
  const membersByTeam = new Map<string, PodiumMember[]>(
    (teams.data?.teams ?? []).map((team) => [
      team.id,
      team.members.map((member) => ({ name: member.name, university: member.university })),
    ]),
  )

  // Data first: only the ranking failing takes over the screen — and only
  // before a current one arrived; a later background refetch that fails keeps
  // the podium up. A cached ranking from before this screen opened is not a
  // fallback: its fetch failing shows the error, never the old podium. A
  // failed team listing still shows the podium, just without members and
  // seals. Waiting for the listing to settle keeps the entry animation from
  // starting with the members missing and popping in halfway.
  const status: PodiumStatus = rankingIsCurrent
    ? teams.isPending
      ? 'loading'
      : 'ready'
    : ranking.isError
      ? 'error'
      : 'loading'

  function retry() {
    ranking.refetch()
    if (teams.isError) teams.refetch()
  }

  // Leaving is idempotent: the exit button calls it, and the
  // `exitFullscreen()` it triggers fires `fullscreenchange`, which calls it
  // again through the board's listener — one navigation, never two.
  const exitedRef = useRef(false)
  const exit = useCallback(() => {
    if (exitedRef.current) return
    exitedRef.current = true
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    // `from` tells /leaderboard to hand focus back to the button that
    // opened this screen (identity.md § 5: on exit, focus returns to the
    // trigger), then it drops the parameter.
    navigate({ to: '/leaderboard', search: { from: 'podium' }, replace: true })
  }, [navigate])

  return (
    <main className="flex flex-1 flex-col bg-background">
      <PodiumBoard
        teams={ranking.data?.teams ?? []}
        membersByTeam={membersByTeam}
        status={status}
        onRetry={retry}
        onExit={exit}
      />
    </main>
  )
}
