import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { VercelAnalytics } from '@/components/analytics'
import { BugReport } from '@/components/bug-report'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { SessionErrorScreen } from '@/components/session-error'
import { useSession } from '@/hooks/use-session'
import { ensureHydrated, getState, subscribe } from '@/lib/session'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    void ensureHydrated()

    // A 401 mid-use (T5's authFetch) drops the session with reason
    // 'expired' — that's the one transition that should bounce to /login,
    // preserving the page the user was on as the return route.
    return subscribe(() => {
      const state = getState()
      if (state.status === 'anonymous' && state.reason === 'expired') {
        // `notice` is what turns a silent bounce into an explanation (#179):
        // the login screen says the session expired instead of appearing out
        // of nowhere.
        router.navigate({
          to: '/login',
          search: { redirect: router.state.location.href, notice: 'expired' },
        })
        return
      }

      // An account on an organizer-issued temporary password (#143) has to
      // change it before anything else. The route guards cover the guarded
      // screens, but the home page has none — and this is what actually makes
      // "before any other screen" true, from wherever the session hydrates.
      if (
        state.status === 'authenticated' &&
        state.user?.mustChangePassword &&
        router.state.location.pathname !== '/change-password'
      ) {
        router.navigate({ to: '/change-password' })
      }
    })
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <VercelAnalytics />
      <Header />
      {/* Hydration gave up (#179). The card takes the outlet's place rather
          than the whole page: header and footer are how the user changes
          language or reaches the organizers while nothing else works. */}
      {status === 'error' ? <SessionErrorScreen /> : <Outlet />}
      <Footer />
      {/* Mounted at the root, so the trigger exists on every route and the
          draft survives closing the dialog (#145). */}
      <BugReport />
    </div>
  )
}
