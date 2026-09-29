import { useMutation, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { useTour } from '@/components/onboarding/tour-provider'
import { useRoundStream } from '@/hooks/use-round-stream'
import { useSession } from '@/hooks/use-session'
import {
  getOnboardingDismissal,
  markOnboardingPrompted,
  setOnboardingDismissal,
  shouldOfferInvite,
  subscribeOnboardingDismissals,
} from '@/lib/onboarding'
import { fetchRounds, ROUNDS_QUERY_KEY } from '@/lib/rounds-query'
import { getState, setSession } from '@/lib/session'

/**
 * The home's onboarding-tour invite (#213): whether to show it, and what
 * answering does.
 *
 * Answering hides the card at once (optimistically) and records the answer on
 * the back. On success the session's user carries the timestamp, so no screen
 * asks again. On failure the card stays hidden for this session and an inline
 * note says we will ask again next time — navigation is never blocked either
 * way. The callbacks live on the mutation, not on `mutate()`, so they still run
 * when the tour has already navigated away from the home.
 */
export function useOnboardingInvite() {
  const { status, user } = useSession()
  const isAuthenticated = status === 'authenticated' && user != null
  const stream = useRoundStream()
  const { startTour } = useTour()
  // Same cache entry the home's round card and the header chip read.
  const rounds = useQuery({
    queryKey: ROUNDS_QUERY_KEY,
    queryFn: fetchRounds,
    enabled: isAuthenticated,
  })
  const userId = user?.id ?? null
  const dismissal = useSyncExternalStore(subscribeOnboardingDismissals, () =>
    userId ? getOnboardingDismissal(userId) : null,
  )

  const mark = useMutation({
    mutationFn: (_answeringUserId: string) => markOnboardingPrompted(),
    onSuccess: (updated) => {
      const session = getState()
      // Only if the same account is still signed in: a logout mid-request
      // must not bring the session back.
      if (session.status === 'authenticated' && session.token && session.user?.id === updated.id) {
        setSession(updated, session.token)
      }
    },
    onError: (_error, answeringUserId) => {
      setOnboardingDismissal(answeringUserId, 'save-failed')
    },
  })

  const offer = shouldOfferInvite({
    user: isAuthenticated ? user : null,
    roundsStatus: rounds.status,
    hasOpenRound: rounds.data?.some((round) => round.status === 'open') ?? false,
    streamRoundId: stream.currentRoundId,
    dismissedThisSession: dismissal !== null,
  })

  function answer(accepted: boolean) {
    if (!userId) return
    setOnboardingDismissal(userId, 'dismissed')
    mark.mutate(userId)
    if (accepted) startTour()
  }

  return {
    offer,
    saveFailed: dismissal === 'save-failed',
    accept: () => answer(true),
    decline: () => answer(false),
    dismissSaveError: () => {
      if (userId) setOnboardingDismissal(userId, 'dismissed')
    },
  }
}
