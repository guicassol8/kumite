import { api } from './api'

// Shared by /organizer/event-config (the full form) and /organizer (the pause
// shortcut on the live round card, #285), so a toggle on either screen
// invalidates the same cache entry.
export const EVENT_CONFIG_QUERY_KEY = ['organizer-event-config']

export async function fetchEventConfig() {
  const res = await api.organizer['event-config'].$get()
  if (!res.ok) throw new Error('failed to load event config')
  return res.json()
}

/**
 * PATCHes only the pause flag (#285). Resolves `true` on a 200, `false` on
 * any other answer; a network failure rejects. The server announces the
 * toggle on the SSE stream, which is what the screens read the state from.
 */
export async function setSubmissionsPaused(paused: boolean): Promise<boolean> {
  const res = await api.organizer['event-config'].$patch({ json: { submissionsPaused: paused } })
  return res.status === 200
}
