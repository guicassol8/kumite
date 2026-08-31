import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      login: { $post: vi.fn() },
    },
    me: { $get: vi.fn() },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, getState } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedLogin = vi.mocked(api.auth.login.$post)
const mockedMe = vi.mocked(api.me.$get)

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
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  mockedLogin.mockReset()
  mockedMe.mockReset()
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
