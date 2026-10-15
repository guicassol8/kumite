import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
    // The footer (#217) is mounted on every route via `__root` and checks
    // the API's health independently of anything this screen does.
    health: { $get: vi.fn() },
  },
}))

// A successful signup navigates to `/`, mounting the real `__root` — which
// now (#217) always opens the shared round SSE stream while authenticated.
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, getState } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedSignup = vi.mocked(api.auth.signup.$post)
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
  name: 'Ada Lovelace',
  role: 'participant',
  university: 'pucrs',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderSignup(initialEntry = '/signup') {
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
  mockedSignup.mockReset()
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

async function fillForm() {
  fireEvent.change(screen.getByTestId('signup-name-input'), {
    target: { value: 'Ada Lovelace' },
  })
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
    fireEvent.change(screen.getByTestId('signup-name-input'), {
      target: { value: 'Ada Lovelace' },
    })
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

  // Acceptance: a signup with no name is refused — client-side here, so the
  // request never leaves the browser.
  it('blocks submit with an empty name and shows the inline error (#122)', async () => {
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()
    fireEvent.change(screen.getByTestId('signup-name-input'), { target: { value: '  ' } })

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    const error = await screen.findByTestId('signup-name-error')
    expect(error.textContent).toContain('nome')
    await waitFor(() => expect(mockedSignup).not.toHaveBeenCalled())
  })

  it('sends the name in the signup payload (#122)', async () => {
    mockedSignup.mockResolvedValue(jsonResponse(201, fakeUser))
    mockedLogin.mockResolvedValue(jsonResponse(200, { token: 'tok-1' }))
    mockedMe.mockResolvedValue(jsonResponse(200, fakeUser))
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    await waitFor(() => expect(mockedSignup).toHaveBeenCalled())
    expect(mockedSignup.mock.calls[0]?.[0]).toMatchObject({
      json: { name: 'Ada Lovelace', email: 'ada@edu.pucrs.br', code: 'PUCRS2026' },
    })
  })

  // kata's 422 is defensive here — the client zod catches the same rules —
  // but when it does arrive, the field gets the catalog string, never the
  // English `issue.message` written for the API's own logs (#312).
  it('puts a 422 body issue under its field, in the catalog language (#312)', async () => {
    mockedSignup.mockResolvedValue(
      jsonResponse(422, {
        error: 'validation_failed',
        message: 'Invalid input',
        issues: { body: [{ path: 'email', message: 'Invalid email', code: 'invalid_string' }] },
      }),
    )
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    const error = await screen.findByTestId('signup-email-error')
    expect(error.textContent).toBe('Valor inválido')
    expect(screen.queryByText('Invalid email')).toBeNull()
    expect(screen.queryByTestId('signup-form-error')).toBeNull()
  })

  it('falls back to the generic error on a 422 with no field issues (#312)', async () => {
    mockedSignup.mockResolvedValue(jsonResponse(422, { error: 'validation_failed' }))
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    const error = await screen.findByTestId('signup-form-error')
    expect(error.textContent).toContain('Não foi possível concluir o cadastro')
  })

  it('shows the generic error when the request never gets an answer (#312)', async () => {
    mockedSignup.mockRejectedValue(new TypeError('Failed to fetch'))
    renderSignup()
    await waitFor(() => screen.getByTestId('signup-email-input'))
    await fillForm()

    fireEvent.click(screen.getByTestId('signup-submit-button'))

    const error = await screen.findByTestId('signup-form-error')
    expect(error.textContent).toContain('Não foi possível concluir o cadastro')
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

it('preserves the destination in the login link', async () => {
  renderSignup('/signup?redirect=%2Fteams')
  const link = await screen.findByTestId('signup-login-link')
  expect(link.getAttribute('href')).toBe('/login?redirect=%2Fteams')
})

it('shows a confirmation error even when both passwords are empty (#200)', async () => {
  renderSignup()
  await screen.findByTestId('signup-submit-button')
  fireEvent.click(screen.getByTestId('signup-submit-button'))
  expect(await screen.findByTestId('signup-confirm-password-error')).toBeDefined()
  expect(mockedSignup).not.toHaveBeenCalled()
})
