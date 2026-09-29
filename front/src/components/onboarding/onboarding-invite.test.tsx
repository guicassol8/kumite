import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    rounds: { $get: vi.fn() },
    me: { onboarding: { $post: vi.fn() } },
  },
}))

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

// The tour itself has its own test (tour-provider.test.tsx); here only
// "did answering start it" matters.
const startTour = vi.fn()
vi.mock('@/components/onboarding/tour-provider', () => ({
  useTour: () => ({ active: false, startTour }),
}))

import { RoundStreamProvider } from '@/hooks/use-round-stream'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { resetOnboardingDismissals } from '@/lib/onboarding'
import { clearSession, getState, type SessionUser, setSession } from '@/lib/session'
import type { SseEvent } from '@/lib/sse-schema'

import { OnboardingInvite } from './onboarding-invite'

const mockedRounds = vi.mocked(api.rounds.$get)
const mockedMark = vi.mocked(api.me.onboarding.$post)

const neverAsked: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  onboardingPromptedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const closedRound = { id: 'r0', name: 'R0', status: 'closed' }
const openRound = { id: 'r1', name: 'R1', status: 'open' }

async function renderInvite() {
  const rootRoute = createRootRoute({ component: () => <OnboardingInvite /> })
  const routeTree = rootRoute.addChildren(
    ['/', '/how-it-works'].map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    ),
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RoundStreamProvider>
        <RouterProvider router={router} />
      </RoundStreamProvider>
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  resetOnboardingDismissals()
  setSession(neverAsked, 'tok-1')
  startTour.mockReset()
  mockedRounds.mockReset()
  mockedRounds.mockResolvedValue(jsonResponse(200, [closedRound]))
  mockedMark.mockReset()
  mockedMark.mockResolvedValue(
    jsonResponse(200, { ...neverAsked, onboardingPromptedAt: '2026-09-28T12:00:00.000Z' }),
  )
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(() => {})
})

afterEach(async () => {
  cleanup()
  clearSession('manual')
  await i18n.changeLanguage('pt')
})

describe('OnboardingInvite', () => {
  it('asks a participant never asked, with no round open, without starting the tour', async () => {
    await renderInvite()

    expect(await screen.findByTestId('onboarding-invite')).toBeDefined()
    expect(screen.getByTestId('onboarding-invite-how-it-works-link').getAttribute('href')).toBe(
      '/how-it-works',
    )
    expect(startTour).not.toHaveBeenCalled()
    expect(mockedMark).not.toHaveBeenCalled()
  })

  it('declining records the answer once, hides the card and does not start the tour', async () => {
    await renderInvite()
    fireEvent.click(await screen.findByTestId('onboarding-invite-decline'))

    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
    await waitFor(() => expect(mockedMark).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getState().user?.onboardingPromptedAt).toBeTruthy())
    expect(startTour).not.toHaveBeenCalled()
    expect(screen.queryByTestId('onboarding-invite-save-error')).toBeNull()
  })

  it('accepting records the answer once and starts the tour', async () => {
    await renderInvite()
    fireEvent.click(await screen.findByTestId('onboarding-invite-accept'))

    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
    expect(startTour).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockedMark).toHaveBeenCalledTimes(1))
  })

  it('a failed save hides the card anyway and says we will ask again', async () => {
    mockedMark.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }))
    await renderInvite()
    fireEvent.click(await screen.findByTestId('onboarding-invite-decline'))

    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
    const note = await screen.findByTestId('onboarding-invite-save-error')
    expect(note.textContent).toContain('perguntaremos de novo')
    expect(getState().user?.onboardingPromptedAt).toBeNull()

    fireEvent.click(screen.getByTestId('onboarding-invite-save-error-dismiss'))
    expect(screen.queryByTestId('onboarding-invite-save-error')).toBeNull()
    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
  })

  it('a network failure is handled the same way, with no unhandled rejection', async () => {
    mockedMark.mockRejectedValue(new TypeError('Failed to fetch'))
    await renderInvite()
    fireEvent.click(await screen.findByTestId('onboarding-invite-accept'))

    expect(await screen.findByTestId('onboarding-invite-save-error')).toBeDefined()
    expect(startTour).toHaveBeenCalledTimes(1)
  })

  it('waits while a round is open in the list', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(200, [openRound]))
    await renderInvite()

    await waitFor(() => expect(mockedRounds).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
  })

  it('waits while the stream reports a live round, and appears once it closes', async () => {
    await renderInvite()
    await screen.findByTestId('onboarding-invite')

    const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
    act(() =>
      onEvent({
        type: 'state.sync',
        submissionsPaused: false,
        serverTime: new Date('2026-09-28T12:00:00.000Z'),
        round: { id: 'r1', closesAt: new Date('2026-09-28T12:30:00.000Z') },
      }),
    )
    expect(screen.queryByTestId('onboarding-invite')).toBeNull()

    act(() =>
      onEvent({
        type: 'state.sync',
        submissionsPaused: false,
        serverTime: new Date('2026-09-28T12:31:00.000Z'),
        round: null,
      }),
    )
    expect(await screen.findByTestId('onboarding-invite')).toBeDefined()
  })

  it('waits while the rounds cannot be loaded', async () => {
    mockedRounds.mockResolvedValue(jsonResponse(500, {}))
    await renderInvite()

    await waitFor(() => expect(mockedRounds).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
  })

  it('is not shown to an organizer', async () => {
    setSession({ ...neverAsked, role: 'organizer' }, 'tok-1')
    await renderInvite()

    await waitFor(() => expect(mockedRounds).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
  })

  it('is not shown once the account has answered', async () => {
    setSession({ ...neverAsked, onboardingPromptedAt: new Date('2026-09-01') }, 'tok-1')
    await renderInvite()

    await waitFor(() => expect(mockedRounds).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.queryByTestId('onboarding-invite')).toBeNull()
  })
})
