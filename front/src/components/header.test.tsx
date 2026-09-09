import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import '@/i18n'

import { clearSession, getState, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function renderHeader(initialEntry = '/login') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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

describe('Header', () => {
  it('shows login/signup links when anonymous', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(screen.getByTestId('header-signup-link')).toBeDefined()
    expect(screen.queryByTestId('header-user-email')).toBeNull()
    expect(screen.queryByTestId('header-logout-button')).toBeNull()
  })

  it('shows the user email and a logout button when authenticated', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-user-email')).toBeDefined())
    expect(screen.getByTestId('header-user-email').textContent).toBe('ada@edu.pucrs.br')
    expect(screen.queryByTestId('header-login-link')).toBeNull()
    expect(screen.queryByTestId('header-signup-link')).toBeNull()
  })

  it('does not show the organizer link for a participant', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-user-email')).toBeDefined())
    expect(screen.queryByTestId('header-organizer-link')).toBeNull()
  })

  it('shows the organizer link for an organizer', async () => {
    setSession({ ...fakeUser, role: 'organizer' }, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-organizer-link')).toBeDefined())
  })

  it('shows the teams link to any authenticated user', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-teams-link')).toBeDefined())
  })

  it('hides the teams link while anonymous', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(screen.queryByTestId('header-teams-link')).toBeNull()
  })

  it('shows the leaderboard link to any authenticated user', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-leaderboard-link')).toBeDefined())
  })

  it('hides the leaderboard link while anonymous', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(screen.queryByTestId('header-leaderboard-link')).toBeNull()
  })

  it('clears the session and navigates home on logout', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderHeader()
    await waitFor(() => expect(screen.getByTestId('header-logout-button')).toBeDefined())

    fireEvent.click(screen.getByTestId('header-logout-button'))

    expect(getState().status).toBe('anonymous')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
  })
})
