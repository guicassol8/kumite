import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getOnboardingDismissal,
  type InviteInput,
  resetOnboardingDismissals,
  setOnboardingDismissal,
  shouldOfferInvite,
  subscribeOnboardingDismissals,
} from './onboarding'

const neverAsked: InviteInput['user'] = {
  role: 'participant',
  mustChangePassword: false,
  onboardingPromptedAt: null,
}

const base: InviteInput = {
  user: neverAsked,
  roundsStatus: 'success',
  hasOpenRound: false,
  streamRoundId: null,
  dismissedThisSession: false,
}

afterEach(() => {
  resetOnboardingDismissals()
})

describe('shouldOfferInvite', () => {
  it('offers the invite to a participant never asked, with no round anywhere', () => {
    expect(shouldOfferInvite(base)).toBe(true)
  })

  it.each<[string, Partial<InviteInput>]>([
    ['no user', { user: null }],
    ['an organizer', { user: { ...neverAsked, role: 'organizer' } }],
    ['already asked', { user: { ...neverAsked, onboardingPromptedAt: new Date('2026-01-01') } }],
    ['a pending password change', { user: { ...neverAsked, mustChangePassword: true } }],
    ['rounds still loading', { roundsStatus: 'pending' }],
    ['rounds failed to load', { roundsStatus: 'error' }],
    ['an open round in the list', { hasOpenRound: true }],
    ['a round live on the stream', { streamRoundId: 'r1' }],
    ['dismissed earlier this session', { dismissedThisSession: true }],
  ])('withholds the invite for %s', (_label, override) => {
    expect(shouldOfferInvite({ ...base, ...override })).toBe(false)
  })

  // The wire carries an ISO string despite the `Date` type (see home's
  // rounds.data note) — a stored answer is a stored answer either way.
  it('treats a wire-format string timestamp as already asked', () => {
    const user = { ...neverAsked, onboardingPromptedAt: '2026-01-01T00:00:00.000Z' as never }
    expect(shouldOfferInvite({ ...base, user })).toBe(false)
  })
})

describe('onboarding dismissal store', () => {
  it('is empty for a user it never saw', () => {
    expect(getOnboardingDismissal('u1')).toBeNull()
  })

  it('keeps one entry per user and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeOnboardingDismissals(listener)

    setOnboardingDismissal('u1', 'save-failed')
    expect(getOnboardingDismissal('u1')).toBe('save-failed')
    expect(getOnboardingDismissal('u2')).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)

    setOnboardingDismissal('u1', 'dismissed')
    expect(getOnboardingDismissal('u1')).toBe('dismissed')
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    setOnboardingDismissal('u2', 'dismissed')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
