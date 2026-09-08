import { api } from './api'

export const ORGANIZER_STATS_QUERY_KEY = ['organizer', 'stats']

export async function fetchOrganizerStats() {
  const res = await api.organizer.stats.$get()
  if (!res.ok) throw new Error('failed to load organizer stats')
  return res.json()
}
