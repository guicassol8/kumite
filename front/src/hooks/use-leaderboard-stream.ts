import { useStreamContext } from './use-round-stream'

export { type LeaderboardStreamState, OFFLINE_AFTER_MS } from './use-event-stream'

import type { LeaderboardStreamState } from './use-event-stream'

/**
 * Live scores for the `/leaderboard` screen, sourced from the `ranking.updated`
 * event (#44).
 *
 * A selector over the app's single `/sse` connection, not a connection of its
 * own (#274): the reducer behind it still runs independently of the round
 * reducer — see `useEventStream` for why the two must not be merged — but they
 * share one socket. Before this, a participant on `/leaderboard` held two
 * connections: the provider's and this hook's.
 *
 * Round-change invalidation is no longer a callback here: the route reads
 * `roundChangedAt` off `useRoundStream()` instead, which is the same signal
 * every other screen already derives from.
 */
export function useLeaderboardStream(): LeaderboardStreamState {
  return useStreamContext('useLeaderboardStream').leaderboard
}
