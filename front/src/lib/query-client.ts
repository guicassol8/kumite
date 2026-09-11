import { QueryClient } from '@tanstack/react-query'

/**
 * The app's single React Query cache.
 *
 * It used to be built inside `main.tsx`, out of reach of anything but the
 * component tree — which is why logging out left the previous user's teams,
 * rounds and rankings in memory for the next one to render (#175). Living in
 * its own module lets `clearSession` empty it on every logout path at once.
 *
 * This module imports nothing of ours on purpose: `session.ts` imports it, and
 * anything it reached back for would close a cycle.
 */
export const queryClient = new QueryClient()
