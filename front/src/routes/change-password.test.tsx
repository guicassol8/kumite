import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    auth: { 'change-password': { $post: vi.fn() } },
    me: { $get: vi.fn() },
    health: { $get: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) },
    teams: Object.assign(vi.fn(), {
      $get: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
    }),
  },
}))

// `sse-client.ts` calls `fetch` directly, outside the RPC client — the
// `@/lib/api` mock above never sees it. Reaching `/` mounts `useEventStream`,
// so without this the stream hits a real server (#168).
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: vi.fn(() => () => {}),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, getState, type SessionUser, setSession } from '@/lib/session'
import { routeTree } from '@/routeTree.gen'

const mockedChangePassword = vi.mocked(api.auth['change-password'].$post)
const mockedMe = vi.mocked(api.me.$get)

const participant: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function response(status: number, body: unknown = undefined): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function renderScreen(entry = '/change-password') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByTestId('change-password-current-input'), {
    target: { value: current },
  })
  fireEvent.change(screen.getByTestId('change-password-new-input'), { target: { value: next } })
  fireEvent.change(screen.getByTestId('change-password-confirm-input'), {
    target: { value: confirm },
  })
  fireEvent.click(screen.getByTestId('change-password-submit-button'))
}

beforeEach(() => {
  vi.clearAllMocks()
  clearSession('manual')
  mockedMe.mockResolvedValue(response(200, { ...participant, mustChangePassword: false }))
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('change-password screen', () => {
  it('sends the change and lands on the home page', async () => {
    setSession(participant, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(204))
    const router = renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('supersecret', 'brand-new-password')

    await waitFor(() => {
      expect(mockedChangePassword).toHaveBeenCalledWith({
        json: { currentPassword: 'supersecret', newPassword: 'brand-new-password' },
      })
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('clears the flag in the session so the guards stop bouncing the user', async () => {
    setSession({ ...participant, mustChangePassword: true }, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(204))
    renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('k7fq-3nrv-9wzt', 'brand-new-password')

    await waitFor(() => {
      expect(getState().user?.mustChangePassword).toBe(false)
    })
  })

  it('shows an error and stays put when the current password is wrong', async () => {
    setSession(participant, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(401, { error: 'invalid_credentials' }))
    const router = renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('not-my-password', 'brand-new-password')

    expect(await screen.findByTestId('change-password-form-error')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/change-password')
  })

  it('rejects a mismatched confirmation before touching the network', async () => {
    setSession(participant, 'tok-1')
    renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('supersecret', 'brand-new-password', 'something-else')

    expect(await screen.findByTestId('change-password-confirm-error')).toBeTruthy()
    expect(mockedChangePassword).not.toHaveBeenCalled()
  })

  it('rejects a new password under 8 characters before touching the network', async () => {
    setSession(participant, 'tok-1')
    renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('supersecret', 'short1')

    expect(await screen.findByTestId('change-password-new-error')).toBeTruthy()
    expect(mockedChangePassword).not.toHaveBeenCalled()
  })

  it('explains itself and offers no way out when the change is mandatory', async () => {
    setSession({ ...participant, mustChangePassword: true }, 'tok-1')
    renderScreen()

    expect(await screen.findByTestId('change-password-required-notice')).toBeTruthy()
    expect(screen.queryByTestId('change-password-back-link')).toBeNull()
  })

  it('offers the way back when the user came here voluntarily', async () => {
    setSession(participant, 'tok-1')
    renderScreen()

    expect(await screen.findByTestId('change-password-back-link')).toBeTruthy()
    expect(screen.queryByTestId('change-password-required-notice')).toBeNull()
  })
})

// #190: the password did change (204), but the `/me` that clears
// `mustChangePassword` in the store failed. Navigating home anyway left every
// guard bouncing the user straight back here, with nothing on screen to say
// why. The screen now stays put and says so.
describe('change-password refresh failure (#190)', () => {
  const flagged: SessionUser = { ...participant, mustChangePassword: true }

  it('stays put and explains itself when the refresh answers 5xx', async () => {
    setSession(flagged, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(204))
    mockedMe.mockResolvedValue(response(502, { error: 'bad_gateway' }))
    const router = renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('k7fq-3nrv-9wzt', 'brand-new-password')

    expect(await screen.findByTestId('change-password-refresh-error')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/change-password')
    // Re-submitting would 401 (`currentPassword` is now the old one), so the
    // form has to be out of reach — only the retry is offered.
    expect(screen.queryByTestId('change-password-submit-button')).toBeNull()
    expect(screen.queryByTestId('change-password-current-input')).toBeNull()
    expect(await screen.findByTestId('change-password-refresh-retry')).toBeTruthy()
    // The store only ever mirrors `/me`: nothing was forged locally.
    expect(getState().user?.mustChangePassword).toBe(true)
  })

  it('handles a refresh that dies at the network layer the same way', async () => {
    setSession(flagged, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(204))
    mockedMe.mockRejectedValue(new TypeError('Failed to fetch'))
    const router = renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('k7fq-3nrv-9wzt', 'brand-new-password')

    expect(await screen.findByTestId('change-password-refresh-error')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/change-password')
    expect(screen.queryByTestId('change-password-form-error')).toBeNull()
  })

  it('retries only the refresh — never the change — and then lands on the home page', async () => {
    setSession(flagged, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(204))
    mockedMe.mockResolvedValue(response(502, { error: 'bad_gateway' }))
    const router = renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('k7fq-3nrv-9wzt', 'brand-new-password')

    const retry = await screen.findByTestId('change-password-refresh-retry')
    mockedMe.mockResolvedValue(response(200, { ...participant, mustChangePassword: false }))
    fireEvent.click(retry)

    await waitFor(() => {
      expect(getState().user?.mustChangePassword).toBe(false)
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
    expect(mockedChangePassword).toHaveBeenCalledTimes(1)
  })

  it('sends a genuinely dead token to /login instead of offering a retry', async () => {
    setSession(flagged, 'tok-1')
    mockedChangePassword.mockResolvedValue(response(204))
    mockedMe.mockResolvedValue(response(401, { error: 'unauthorized' }))
    const router = renderScreen()

    await screen.findByTestId('change-password-submit-button')
    fill('k7fq-3nrv-9wzt', 'brand-new-password')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
    expect(await screen.findByTestId('login-expired-notice')).toBeTruthy()
    expect(getState().status).toBe('anonymous')
    expect(screen.queryByTestId('change-password-refresh-error')).toBeNull()
  })
})

// AC3: landing back here after a guard bounced the user is not self-evident.
describe('change-password bounce notice (#190)', () => {
  it('explains the bounce when the guards sent the user back', async () => {
    setSession({ ...participant, mustChangePassword: true }, 'tok-1')
    renderScreen('/change-password?notice=required')

    expect(await screen.findByTestId('change-password-bounced-notice')).toBeTruthy()
    // One alert, never two: the bounce message replaces the generic one.
    expect(screen.queryByTestId('change-password-required-notice')).toBeNull()
  })

  it('keeps the generic notice when the user arrived on their own', async () => {
    setSession({ ...participant, mustChangePassword: true }, 'tok-1')
    renderScreen()

    expect(await screen.findByTestId('change-password-required-notice')).toBeTruthy()
    expect(screen.queryByTestId('change-password-bounced-notice')).toBeNull()
  })
})
