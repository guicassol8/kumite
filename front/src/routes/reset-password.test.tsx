import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      'request-password-reset': { $post: vi.fn() },
      'complete-password-reset': { $post: vi.fn() },
    },
    // The footer (#217) is mounted on every route via `__root` and checks
    // the API's health independently of anything this screen does.
    health: { $get: vi.fn() },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { routeTree } from '@/routeTree.gen'

const mockedRequest = vi.mocked(api.auth['request-password-reset'].$post)
const mockedComplete = vi.mocked(api.auth['complete-password-reset'].$post)
const mockedHealth = vi.mocked(api.health.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stub
function jsonResponse(status: number, body: unknown = undefined): any {
  return { status, json: async () => body }
}

function renderResetPassword() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/reset-password'] }),
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
  mockedRequest.mockReset()
  mockedRequest.mockResolvedValue(jsonResponse(204))
  mockedComplete.mockReset()
  mockedHealth.mockReset()
  mockedHealth.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
})

// Step 1: ask for a code. Every step-2 test walks through it first, since the
// code form only exists once a code has been requested.
async function requestCode(email = 'ada@edu.pucrs.br') {
  await waitFor(() => screen.getByTestId('reset-password-request-email-input'))
  fireEvent.change(screen.getByTestId('reset-password-request-email-input'), {
    target: { value: email },
  })
  fireEvent.click(screen.getByTestId('reset-password-request-submit'))
  await screen.findByTestId('reset-password-request-sent')
}

function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    email: 'ada@edu.pucrs.br',
    otp: '123456',
    newPassword: 'brandnewpassword',
    confirmPassword: 'brandnewpassword',
    ...overrides,
  }
  fireEvent.change(screen.getByTestId('reset-password-email-input'), {
    target: { value: values.email },
  })
  fireEvent.change(screen.getByTestId('reset-password-otp-input'), {
    target: { value: values.otp },
  })
  fireEvent.change(screen.getByTestId('reset-password-new-password-input'), {
    target: { value: values.newPassword },
  })
  fireEvent.change(screen.getByTestId('reset-password-confirm-password-input'), {
    target: { value: values.confirmPassword },
  })
}

describe('ResetPasswordScreen — step 1, requesting a code', () => {
  it('posts the email and moves on to the code form, with the email carried over', async () => {
    renderResetPassword()
    await requestCode()

    expect(mockedRequest).toHaveBeenCalledWith({
      json: { email: 'ada@edu.pucrs.br', locale: 'pt' },
    })
    const emailInput = screen.getByTestId('reset-password-email-input') as HTMLInputElement
    expect(emailInput.value).toBe('ada@edu.pucrs.br')
  })

  it('shows a generic error when the request fails, and stays on step 1', async () => {
    mockedRequest.mockRejectedValue(new Error('network down'))
    renderResetPassword()
    await waitFor(() => screen.getByTestId('reset-password-request-email-input'))

    fireEvent.change(screen.getByTestId('reset-password-request-email-input'), {
      target: { value: 'ada@edu.pucrs.br' },
    })
    fireEvent.click(screen.getByTestId('reset-password-request-submit'))

    expect(await screen.findByTestId('reset-password-request-error')).toBeDefined()
    expect(screen.queryByTestId('reset-password-otp-input')).toBeNull()
  })

  // No malformed-email case here: the field is an `<input type="email">`, so
  // jsdom's own constraint validation swallows the submit before react-hook-form
  // ever sees it — exactly as a browser would. The zod message stays as the
  // fallback for values the native check lets through.

  it('goes back to step 1 to send the code somewhere else', async () => {
    renderResetPassword()
    await requestCode()

    fireEvent.click(screen.getByTestId('reset-password-request-back'))

    expect(await screen.findByTestId('reset-password-request-email-input')).toBeDefined()
    expect(screen.queryByTestId('reset-password-otp-input')).toBeNull()
  })
})

describe('ResetPasswordScreen — step 2, completing the reset', () => {
  it('shows a success state on 204, no field-level errors', async () => {
    mockedComplete.mockResolvedValue(jsonResponse(204))
    renderResetPassword()
    await requestCode()

    fillForm()
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-success')).toBeDefined()
    expect(mockedComplete).toHaveBeenCalledWith({
      json: { email: 'ada@edu.pucrs.br', otp: '123456', newPassword: 'brandnewpassword' },
    })
  })

  it('shows a single generic error on an invalid/expired code, never field-level', async () => {
    mockedComplete.mockResolvedValue(jsonResponse(400, { error: 'invalid_otp', message: 'nope' }))
    renderResetPassword()
    await requestCode()

    fillForm()
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    const alert = await screen.findByTestId('reset-password-form-error')
    expect(alert.textContent).toContain('Código inválido ou expirado')
    expect(screen.queryByTestId('reset-password-success')).toBeNull()
  })

  // #195 (achado #29): a dead network used to reject out of onSubmit with no
  // message at all, and any non-204 read as "invalid code" — which sends the
  // user off to request a new code when the one they have is still good.
  it('says the reset could not be completed on a dead network, keeping every field', async () => {
    mockedComplete.mockRejectedValueOnce(new Error('network down'))
    renderResetPassword()
    await requestCode()

    fillForm()
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    const alert = await screen.findByTestId('reset-password-form-error')
    expect(alert.textContent).toContain('Não foi possível redefinir a senha')
    expect(alert.textContent).not.toContain('Código inválido')
    expect(screen.getByTestId<HTMLInputElement>('reset-password-otp-input').value).toBe('123456')
    expect(screen.getByTestId<HTMLInputElement>('reset-password-email-input').value).toBe(
      'ada@edu.pucrs.br',
    )

    // One click retries with the very same code.
    mockedComplete.mockResolvedValueOnce(jsonResponse(204))
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-success')).toBeDefined()
    expect(mockedComplete).toHaveBeenCalledTimes(2)
    expect(mockedComplete).toHaveBeenLastCalledWith({
      json: { email: 'ada@edu.pucrs.br', otp: '123456', newPassword: 'brandnewpassword' },
    })
  })

  it('does not call an undeclared status (500) an invalid code', async () => {
    mockedComplete.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }))
    renderResetPassword()
    await requestCode()

    fillForm()
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    const alert = await screen.findByTestId('reset-password-form-error')
    expect(alert.textContent).toContain('Não foi possível redefinir a senha')
    expect(alert.textContent).not.toContain('Código inválido')
  })

  it('rejects mismatched passwords client-side, without calling the API', async () => {
    renderResetPassword()
    await requestCode()

    fillForm({ confirmPassword: 'somethingelse' })
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-confirm-password-error')).toBeDefined()
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('rejects a malformed (non-6-digit) code client-side, without calling the API', async () => {
    renderResetPassword()
    await requestCode()

    fillForm({ otp: '123' })
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-otp-error')).toBeDefined()
    expect(mockedComplete).not.toHaveBeenCalled()
  })
})
