import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      'complete-password-reset': { $post: vi.fn() },
    },
  },
}))

import '@/i18n'

import { api } from '@/lib/api'
import { routeTree } from '@/routeTree.gen'

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
  mockedComplete.mockReset()
})

afterEach(() => {
  cleanup()
})

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

describe('ResetPasswordScreen', () => {
  it('shows a success state on 204, no field-level errors', async () => {
    mockedComplete.mockResolvedValue(jsonResponse(204))
    renderResetPassword()
    await waitFor(() => screen.getByTestId('reset-password-email-input'))

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
    await waitFor(() => screen.getByTestId('reset-password-email-input'))

    fillForm()
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-form-error')).toBeDefined()
    expect(screen.queryByTestId('reset-password-success')).toBeNull()
  })

  it('rejects mismatched passwords client-side, without calling the API', async () => {
    renderResetPassword()
    await waitFor(() => screen.getByTestId('reset-password-email-input'))

    fillForm({ confirmPassword: 'somethingelse' })
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-confirm-password-error')).toBeDefined()
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('rejects a malformed (non-6-digit) code client-side, without calling the API', async () => {
    renderResetPassword()
    await waitFor(() => screen.getByTestId('reset-password-email-input'))

    fillForm({ otp: '123' })
    fireEvent.click(screen.getByTestId('reset-password-submit-button'))

    expect(await screen.findByTestId('reset-password-otp-error')).toBeDefined()
    expect(mockedComplete).not.toHaveBeenCalled()
  })
})
