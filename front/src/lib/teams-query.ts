import { api } from './api'

// One definition for the two screens that read the listing (the /teams route
// and the home card), so they share a cache entry and a single invalidation.
export const TEAMS_QUERY_KEY = ['teams']

export async function fetchTeams() {
  const res = await api.teams.$get()
  if (!res.ok) throw new Error('failed to load teams')
  return res.json()
}
