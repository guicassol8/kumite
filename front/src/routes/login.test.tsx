import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      login: { $post: vi.fn() },
    },
    me: { $get: vi.fn() },
    // The footer (#217) is mounted on every route via `__root` and checks
    // the API's health independently of anything this screen does.
    health: { $get: vi.fn() },
  },
}))

// A successful login navigates to `/`, mounting the real `__root` — which
// now (#217) always opens the shared round SSE stream while authenticated.
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, getState } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedLogin = vi.mocked(api.auth.login.$post)
const mockedMe = vi.mocked(api.me.$get)
const mockedHealth = vi.mocked(api.health.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, json: async () => body }
}

const fakeUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderLogin(initialEntry = '/login') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  mockedLogin.mockReset()
  mockedMe.mockReset()
  mockedHealth.mockReset()
  mockedHealth.mockReturnValue(new Promise(() => {}))
  clearSession('manual')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('LoginScreen', () => {
  it('shows a single generic error on invalid credentials, never field-level', async () => {
    mockedLogin.mockResolvedValue(
      jsonResponse(401, { error: 'invalid_credentials', message: 'nope' }),
    )
    renderLogin()
    await waitFor(() => screen.getByTestId('login-email-input'))

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'ada@edu.pucrs.br' },
    })
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-form-error')).toBeDefined()
    expect(screen.queryByTestId('login-email-error')).toBeNull()
    expect(screen.queryByTestId('login-password-error')).toBeNull()
  })

  it('shows the inline error under the email field for an invalid email', async () => {
    renderLogin()
    await waitFor(() => screen.getByTestId('login-email-input'))

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'supersecret' },
    })
    fireEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-email-error')).toBeDefined()
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('shows the inline error under the password field for an empty password', async () => {
    renderLogin()
    await waitFor(() => screen.getByTestId('login-email-input'))

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'ada@edu.pucrs.br' },
    })
    fireEvent.click(screen.getByTestId('login-submit-button'))

    expect(await screen.findByTestId('login-password-error')).toBeDefined()
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('offers a way out to the self-service password reset', async () => {
    renderLogin()
    await waitFor(() => screen.getByTestId('login-email-input'))

    const link = screen.getByTestId('login-forgot-password-link')
    expect(link.getAttribute('href')).toBe('/reset-password')
  })

  it('stores the session and navigates to the preserved redirect on success', async () => {
    mockedLogin.mockResolvedValue(jsonResponse(200, { token: 'tok-1' }))
    mockedMe.mockResolvedValue(jsonResponse(200, fakeUser))
    const router = renderLogin('/login?redirect=%2Fproblem')
    await waitFor(() => screen.getByTestId('login-email-input'))

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'ada@edu.pucrs.br' },
    })
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'supersecret' },
    })
    fireEvent.click(screen.getByTestId('login-submit-button'))

    await waitFor(() => {
      expect(getState()).toMatchObject({ status: 'authenticated', token: 'tok-1' })
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/problem')
    })
  })

  it('navigates to / when there is no preserved redirect', async () => {
    mockedLogin.mockResolvedValue(jsonResponse(200, { token: 'tok-1' }))
    mockedMe.mockResolvedValue(jsonResponse(200, fakeUser))
    const router = renderLogin()
    await waitFor(() => screen.getByTestId('login-email-input'))

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'ada@edu.pucrs.br' },
    })
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'supersecret' },
    })
    fireEvent.click(screen.getByTestId('login-submit-button'))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })
})

// #179: the root sends `notice=expired` here when hydration finds the stored
// token dead. Without the banner the user is dropped on a login form with no
// idea why the app stopped trusting them.
describe('LoginScreen expired-session notice (#179)', () => {
  it('explains why the user is back on the login screen', async () => {
    renderLogin('/login?notice=expired')

    await waitFor(() => expect(screen.getByTestId('login-expired-notice')).toBeDefined())
  })

  it('shows nothing when the user came here on their own', async () => {
    renderLogin('/login')

    await waitFor(() => screen.getByTestId('login-email-input'))
    expect(screen.queryByTestId('login-expired-notice')).toBeNull()
  })

  it('still preserves the return route alongside the notice', async () => {
    const router = renderLogin('/login?notice=expired&redirect=%2Fteams')

    await waitFor(() => expect(screen.getByTestId('login-expired-notice')).toBeDefined())
    expect(router.state.location.search).toMatchObject({
      notice: 'expired',
      redirect: '/teams',
    })
  })
})
