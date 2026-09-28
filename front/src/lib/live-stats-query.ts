import { api } from './api'

// Not ['organizer', 'stats', 'live']: the overview invalidates
// ['organizer', 'stats'] on every ranking.updated, and a key under it would be
// dragged along by prefix. The live card polls on its own clock (#279).
export const ORGANIZER_LIVE_STATS_QUERY_KEY = ['organizer', 'live-stats']

export async function fetchOrganizerLiveStats() {
  const res = await api.organizer.stats.live.$get()
  if (!res.ok) throw new Error('failed to load organizer live stats')
  return res.json()
}
