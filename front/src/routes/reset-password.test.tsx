import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      'request-password-reset': { $post: vi.fn() },
      'complete-password-reset': { $post: vi.fn() },
    },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { routeTree } from '@/routeTree.gen'

const mockedRequest = vi.mocked(api.auth['request-password-reset'].$post)
const mockedComplete = vi.mocked(api.auth['complete-password-reset'].$post)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stub
function jsonResponse(status: number, body: unknown = undefined): any {
  return { status, json: async () => body }
}

function renderResetPassword() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/reset-password'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  mockedRequest.mockReset()
  mockedRequest.mockResolvedValue(jsonResponse(204))
  mockedComplete.mockReset()
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

    expect(mockedRequest).toHaveBeenCalledWith({ json: { email: 'ada@edu.pucrs.br' } })
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

    expect(await screen.findByTestId('reset-password-form-error')).toBeDefined()
    expect(screen.queryByTestId('reset-password-success')).toBeNull()
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
