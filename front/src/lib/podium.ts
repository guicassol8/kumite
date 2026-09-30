/** Places on the podium itself (#284). */
export const PODIUM_PLACES = 3
/** The last place the list under the podium shows. */
export const LAST_LISTED_PLACE = 10

/**
 * Splits the event ranking into the podium (1st–3rd) and the list under it
 * (4th–10th), for the closing ceremony (#284).
 *
 * Only teams that scored take a place (P1-A): the event ranking lists every
 * active team, zeros included, and a zero-point team picked alphabetically
 * would otherwise stand on the podium of an event with only two scorers.
 * With fewer scorers than places, only the places that exist are returned.
 *
 * The back ranks by total first (`rankTeams`), so every zero sits below every
 * scorer and the remaining ranks stay 1..k with no gap — nothing to renumber.
 * Order comes from `rank`, not from the array: the payload is sorted today,
 * but the podium must not depend on it.
 */
export function selectPodium<T extends { rank: number; totalScore: number }>(
  teams: readonly T[],
): { podium: T[]; rest: T[] } {
  const scored = teams.filter((team) => team.totalScore > 0).sort((a, b) => a.rank - b.rank)
  return {
    podium: scored.slice(0, PODIUM_PLACES),
    rest: scored.slice(PODIUM_PLACES, LAST_LISTED_PLACE),
  }
}
