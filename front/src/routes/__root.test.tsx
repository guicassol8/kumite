import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import '@/i18n'

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function renderApp() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
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
