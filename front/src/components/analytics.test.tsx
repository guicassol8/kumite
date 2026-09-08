import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Both Vercel components inject a remote script and start reporting on mount.
// Mocking them keeps the test offline and lets us assert on exactly what the
// app hands them — the props ARE the contract here.
const analyticsProps = vi.fn()
const speedInsightsProps = vi.fn()

vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: Record<string, unknown>) => {
    analyticsProps(props)
    return null
  },
}))

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: (props: Record<string, unknown>) => {
    speedInsightsProps(props)
    return null
  },
}))

import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router'

import { VercelAnalytics } from './analytics'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <VercelAnalytics />
      <Outlet />
    </>
  ),
})
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
})
const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teams',
  component: () => null,
})
const problemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/problem/$id',
  component: () => null,
})
const routeTree = rootRoute.addChildren([indexRoute, teamsRoute, problemRoute])

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

const lastProps = (spy: typeof analyticsProps) =>
  spy.mock.calls[spy.mock.calls.length - 1]?.[0] as Record<string, unknown> | undefined

beforeEach(() => {
  analyticsProps.mockClear()
  speedInsightsProps.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('VercelAnalytics', () => {
  it('mounts neither collector outside a production build', async () => {
    const router = renderAt('/')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    expect(analyticsProps).not.toHaveBeenCalled()
    expect(speedInsightsProps).not.toHaveBeenCalled()
  })

  it('reports the route pattern, never the real id, on a dynamic route', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production')
    const router = renderAt('/problem/6f1a2b3c-0000-4000-8000-abcdefabcdef')
    await waitFor(() => expect(analyticsProps).toHaveBeenCalled())
    expect(router.state.location.pathname).toContain('6f1a2b3c')

    expect(lastProps(analyticsProps)).toMatchObject({
      route: '/problem/[id]',
      path: '/problem/[id]',
    })
    expect(lastProps(speedInsightsProps)).toMatchObject({ route: '/problem/[id]' })
  })

  it('updates the reported route on client-side navigation', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production')
    const router = renderAt('/')
    await waitFor(() => expect(lastProps(analyticsProps)).toMatchObject({ route: '/' }))

    await router.navigate({ to: '/teams' })

    await waitFor(() => expect(lastProps(analyticsProps)).toMatchObject({ route: '/teams' }))
    await waitFor(() => expect(lastProps(speedInsightsProps)).toMatchObject({ route: '/teams' }))
  })

  it('rewrites the event url to the pattern, dropping ids and query strings', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production')
    renderAt('/problem/6f1a2b3c-0000-4000-8000-abcdefabcdef')
    await waitFor(() => expect(analyticsProps).toHaveBeenCalled())

    const beforeSend = lastProps(analyticsProps)?.beforeSend as (event: {
      type: string
      url: string
    }) => { url: string }

    const scrubbed = beforeSend({
      type: 'pageview',
      url: 'https://kumite.app/problem/6f1a2b3c-0000-4000-8000-abcdefabcdef?from=leaderboard',
    })

    expect(scrubbed.url).toBe('https://kumite.app/problem/[id]')
    expect(scrubbed.url).not.toContain('6f1a2b3c')
    expect(scrubbed.url).not.toContain('from=leaderboard')
  })

  it('keeps the same beforeSend identity across navigations', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production')
    const router = renderAt('/')
    await waitFor(() => expect(analyticsProps).toHaveBeenCalled())
    const first = lastProps(analyticsProps)?.beforeSend

    await router.navigate({ to: '/teams' })
    await waitFor(() => expect(lastProps(analyticsProps)).toMatchObject({ route: '/teams' }))

    expect(lastProps(analyticsProps)?.beforeSend).toBe(first)
  })
})
