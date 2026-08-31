import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { Header } from '@/components/header'
import { ensureHydrated, getState, subscribe } from '@/lib/session'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()

  useEffect(() => {
    void ensureHydrated()

    // A 401 mid-use (T5's authFetch) drops the session with reason
    // 'expired' — that's the one transition that should bounce to /login,
    // preserving the page the user was on as the return route.
    return subscribe(() => {
      const state = getState()
      if (state.status === 'anonymous' && state.reason === 'expired') {
        router.navigate({ to: '/login', search: { redirect: router.state.location.href } })
      }
    })
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header />
      <Outlet />
    </div>
  )
}
