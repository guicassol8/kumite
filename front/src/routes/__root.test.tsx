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

import '@/i18n'

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
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
})

describe('root session bootstrap', () => {
  it('redirects to /login preserving the return route when the session expires mid-use', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    clearSession('expired')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toMatchObject({
      redirect: expect.stringContaining('/'),
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
