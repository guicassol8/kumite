import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      signup: { $post: vi.fn() },
      login: { $post: vi.fn() },
    },
    me: { $get: vi.fn() },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, getState } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedSignup = vi.mocked(api.auth.signup.$post)
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

function renderSignup() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/signup'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  mockedSignup.mockReset()
  mockedLogin.mockReset()
  mockedMe.mockReset()
  clearSession('manual')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

async function fillForm() {
  fireEvent.change(screen.getByTestId('signup-email-input'), {
    target: { value: 'ada@edu.pucrs.br' },
  })
  fireEvent.change(screen.getByTestId('signup-password-input'), {
    target: { value: 'supersecret' },
  })
  fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
    target: { value: 'supersecret' },
  })
  fireEvent.change(screen.getByTestId('signup-code-input'), {
    target: { value: 'PUCRS2026' },
  })
}

describe('SignupScreen', () => {
  it('shows the email field error when the event code domain does not match', async () => {
    mockedSignup.mockResolvedValue(
      jsonResponse(400, { error: 'invalid_email_domain', message: 'nope' }),
    )
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    const error = await screen.findByTestId('signup-email-error')
    expect(error.textContent).toContain('universidade')
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('shows the email field error when the email is already in use', async () => {
    mockedSignup.mockResolvedValue(jsonResponse(400, { error: 'signup_failed', message: 'nope' }))
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    const error = await screen.findByTestId('signup-email-error')
    expect(error.textContent).toContain('cadastrado')
  })

  it('blocks submit client-side on a password/confirm mismatch, without calling the API', async () => {
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    fireEvent.change(screen.getByTestId('signup-email-input'), {
      target: { value: 'ada@edu.pucrs.br' },
    })
    fireEvent.change(screen.getByTestId('signup-password-input'), {
      target: { value: 'supersecret' },
    })
    fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
      target: { value: 'different1' },
    })
    fireEvent.change(screen.getByTestId('signup-code-input'), { target: { value: 'PUCRS2026' } })

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    await waitFor(() => expect(mockedSignup).not.toHaveBeenCalled())
  })

  it('auto-logs in and stores the session on a successful signup', async () => {
    mockedSignup.mockResolvedValue(jsonResponse(201, fakeUser))
    mockedLogin.mockResolvedValue(jsonResponse(200, { token: 'tok-1' }))
    mockedMe.mockResolvedValue(jsonResponse(200, fakeUser))
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    await waitFor(() => {
      expect(getState()).toMatchObject({ status: 'authenticated', token: 'tok-1' })
    })
  })
})
