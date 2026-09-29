import { api } from './api'
import type { SessionUser } from './session'

/**
 * The onboarding-tour invite (#213): asked once per account, answered on the
 * back (`POST /me/onboarding`), so the answer holds on every lab machine.
 */

export type InviteInput = {
  user: Pick<SessionUser, 'role' | 'mustChangePassword' | 'onboardingPromptedAt'> | null
  /** The `GET /rounds` query's status — only 'success' tells us there is no round. */
  roundsStatus: 'pending' | 'error' | 'success'
  hasOpenRound: boolean
  /** The shared `/sse` stream's `currentRoundId`. */
  streamRoundId: string | null
  dismissedThisSession: boolean
}

/**
 * Whether the home should show the invite right now.
 *
 * Only participants are asked (the tour walks the participant's flow; an
 * organizer still reaches it from the user menu). It waits out any open round
 * — from the rounds list *and* the live stream — and also waits while the
 * rounds are loading or failed, since then we cannot tell a competition is
 * not running. A pending password change goes first: that screen owns the
 * session until it is done.
 */
export function shouldOfferInvite(input: InviteInput): boolean {
  const { user } = input
  if (!user || user.role !== 'participant') return false
  if (user.mustChangePassword) return false
  if (user.onboardingPromptedAt != null) return false
  if (input.dismissedThisSession) return false
  if (input.roundsStatus !== 'success') return false
  if (input.hasOpenRound || input.streamRoundId != null) return false
  return true
}

/** Records the answer — accepted or declined, the back keeps the first one. */
export async function markOnboardingPrompted() {
  const res = await api.me.onboarding.$post()
  if (res.status !== 200) throw new Error('failed to save the onboarding answer')
  return res.json()
}

// --- Session-scoped dismissal, per user ---
//
// Answering hides the card at once, before the POST settles. If the POST
// fails, the account is still "never asked" on the back, so without this the
// card would come right back on the next render of the home. The flag is in
// memory on purpose: a failed save means "ask again next time", and a reload
// is the next time. 'save-failed' also drives the inline error note.

export type OnboardingDismissal = 'dismissed' | 'save-failed'

const dismissals = new Map<string, OnboardingDismissal>()
const listeners = new Set<() => void>()

export function getOnboardingDismissal(userId: string): OnboardingDismissal | null {
  return dismissals.get(userId) ?? null
}

export function setOnboardingDismissal(userId: string, value: OnboardingDismissal): void {
  dismissals.set(userId, value)
  for (const listener of listeners) listener()
}

export function subscribeOnboardingDismissals(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only: the store is a module singleton. */
export function resetOnboardingDismissals(): void {
  dismissals.clear()
  for (const listener of listeners) listener()
}
