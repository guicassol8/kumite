import { api } from './api'

// One definition for the two organizer screens that read the moderation
// listing — /organizer/teams and the pódio (#284) — so they share a cache
// entry and a single invalidation. It used to live in the route file, and a
// route file that exports anything besides `Route` drops out of the router's
// `autoCodeSplitting`.
export const ORGANIZER_TEAMS_QUERY_KEY = ['organizer-teams']

export async function fetchOrganizerTeams() {
  const res = await api.organizer.teams.$get()
  if (!res.ok) throw new Error('failed to load teams')
  return res.json()
}

export type OrganizerTeamsList = Awaited<ReturnType<typeof fetchOrganizerTeams>>
export type OrganizerTeam = OrganizerTeamsList['teams'][number]
