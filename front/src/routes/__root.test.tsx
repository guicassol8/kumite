import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The home route queries the API for the viewer's team; without this the
// bootstrap under test would depend on a real server answering (a 401 from
// one would itself drop the session and defeat the test).
vi.mock('@/lib/api', () => ({
  api: {
    health: { $get: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) },
    teams: Object.assign(vi.fn(), {
      $get: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
    }),
    me: { $get: vi.fn() },
  },
}))

// `sse-client.ts` calls `fetch` directly, outside the RPC client — the
// `@/lib/api` mock above never sees it. The home route mounts `useEventStream`,
// so without this the stream hits a real server (#168).
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

// The real collectors inject a remote script on mount. These stand-ins render a
// marker instead, so "exactly once in the tree" is something the DOM can answer
// no matter how often React re-renders the root.
vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics-mounted" />,
}))

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => <div data-testid="vercel-speed-insights-mounted" />,
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, retryHydration, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedGetMe = vi.mocked(api.me.$get)

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function renderApp(initialPath = '/') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  clearSession('manual')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
  vi.unstubAllEnvs()
})

describe('root session bootstrap', () => {
  it('redirects to /login preserving the return route when the session expires mid-use', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    clearSession('expired')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    // `notice` is the difference between a login screen that appeared for no
    // reason and one that says why (#179).
    expect(router.state.location.search).toMatchObject({
      redirect: expect.stringContaining('/'),
      notice: 'expired',
    })
  })

  it('does not redirect on a manual logout', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    clearSession('manual')

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(router.state.location.pathname).toBe('/')
  })

  // The home route has no guard of its own, so this subscription is what
  // actually makes "before any other screen" true after an organizer reset
  // (#143) — the route guards are the second line, for deep links.
  it('sends an account on a temporary password to /change-password', async () => {
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    setSession({ ...fakeUser, mustChangePassword: true }, 'tok-1')

    await waitFor(() => expect(router.state.location.pathname).toBe('/change-password'))
    // #190: same notice the guards use — the screen has to be able to say why
    // the user is suddenly looking at it.
    expect(router.state.location.search).toMatchObject({ notice: 'required' })
  })

  it('leaves an unflagged session where it is', async () => {
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    setSession(fakeUser, 'tok-1')

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(router.state.location.pathname).toBe('/')
  })

  // #168 asked whether this effect needs a guard against steering a router
  // that is already unmounted — the thing that turns a stray 401 into a ghost
  // navigation. It does not, and this pins why: the effect's body is
  // `return subscribe(...)`, so the subscription IS the cleanup. React drops
  // the listener on unmount and a later expiry reaches nobody, which is why
  // no defensive check was added to production code. Delete that `return` and
  // this test goes red.
  it('stops listening once unmounted: an expiry after teardown steers nothing', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    cleanup()
    clearSession('expired')

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(router.state.location.pathname).toBe('/')
  })
})

// #179: the failure the user actually sees. Real timers here — the tree under
// test is a live router, and the store's 0/500/1500ms backoff is the thing
// being waited on, so these two run for ~2s each on purpose.
describe('root session hydration failure (#179)', () => {
  afterEach(() => {
    mockedGetMe.mockReset()
  })

  // `setSession` + a non-awaited `retryHydration` is what puts a token in the
  // store without authenticating it. Rendering while that cycle is in flight
  // is deliberate: the root's own `ensureHydrated()` joins the same promise
  // instead of starting a second round of attempts.
  function startFailingHydration(): Promise<void> {
    setSession(fakeUser, 'tok-1')
    mockedGetMe.mockRejectedValue(new TypeError('Failed to fetch'))
    return retryHydration()
  }

  it('replaces the route with the retry card when hydration gives up', async () => {
    const hydrating = startFailingHydration()
    renderApp('/')
    await hydrating

    await waitFor(() => expect(screen.getByTestId('session-error-card')).toBeDefined())
    // The route below it is gone, not merely covered — nothing on the home
    // screen should be firing queries against a session we could not load.
    expect(screen.queryByTestId('home-round-card')).toBeNull()
  }, 15_000)

  it('keeps the header and the footer reachable behind the card', async () => {
    const hydrating = startFailingHydration()
    renderApp('/')
    await hydrating

    await waitFor(() => expect(screen.getByTestId('session-error-card')).toBeDefined())
    expect(screen.getByTestId('app-header')).toBeDefined()
    expect(screen.getByTestId('app-footer')).toBeDefined()
  }, 15_000)
})

// The footer is the only contact channel during the event, so it must survive
// every route and both session states — especially the auth screens, where a
// user who cannot get in is the one who most needs to reach the organizers.
describe('global footer', () => {
  it('renders on the home route for an anonymous visitor', async () => {
    renderApp('/')

    await waitFor(() => expect(screen.getByTestId('app-footer')).toBeDefined())
    expect(screen.getByTestId('footer-contact-email').getAttribute('href')).toBe(
      'mailto:ligadealgoritmos@gmail.com',
    )
  })

  it('renders on /login, where the visitor has no session at all', async () => {
    renderApp('/login')

    await waitFor(() => expect(screen.getByTestId('app-footer')).toBeDefined())
    expect(screen.getByTestId('footer-contact-email').getAttribute('href')).toBe(
      'mailto:ligadealgoritmos@gmail.com',
    )
  })

  it('renders for an authenticated user', async () => {
    setSession(fakeUser, 'tok-1')
    renderApp('/')

    await waitFor(() => expect(screen.getByTestId('app-footer')).toBeDefined())
  })
})

describe('root telemetry', () => {
  it('mounts each Vercel collector exactly once in a production build', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production')
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    expect(screen.getAllByTestId('vercel-analytics-mounted')).toHaveLength(1)
    expect(screen.getAllByTestId('vercel-speed-insights-mounted')).toHaveLength(1)
  })

  it('mounts neither collector in dev or under test', async () => {
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    expect(screen.queryByTestId('vercel-analytics-mounted')).toBeNull()
    expect(screen.queryByTestId('vercel-speed-insights-mounted')).toBeNull()
  })
})
