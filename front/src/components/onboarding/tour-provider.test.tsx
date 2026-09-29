import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    practice: { problems: { $get: vi.fn() } },
    me: { onboarding: { $post: vi.fn() } },
  },
}))

import i18n from '@/i18n'
import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'

import { TOUR_TARGET_TIMEOUT_MS, TourProvider, useTour } from './tour-provider'

const mockedPractice = vi.mocked(api.practice.problems.$get)
const mockedMark = vi.mocked(api.me.onboarding.$post)

const participant: SessionUser = {
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

// Stand-ins for the real screens: each renders the testids the tour points
// at, and nothing else — the tour only needs them present.
let showRoundCard = true

function StartTourButton() {
  const { startTour } = useTour()
  return (
    <button type="button" data-testid="start" onClick={startTour}>
      start
    </button>
  )
}

const rootRoute = createRootRoute({
  component: () => (
    <TourProvider>
      <StartTourButton />
      <div data-testid="language-selector" />
      <Outlet />
    </TourProvider>
  ),
})
const screens: Array<[string, () => React.ReactNode]> = [
  ['/', () => (showRoundCard ? <div data-testid="home-round-card" /> : null)],
  ['/teams', () => <h1 data-testid="teams-heading">teams</h1>],
  ['/leaderboard', () => <div data-testid="leaderboard-tabs" />],
  ['/practice', () => <div data-testid="practice-empty" />],
  ['/practice/$id', () => <div data-testid="problem-workspace-panel" />],
  ['/elsewhere', () => <div data-testid="elsewhere" />],
]
const routeTree = rootRoute.addChildren(
  screens.map(([path, component]) =>
    createRoute({ getParentRoute: () => rootRoute, path, component }),
  ),
)

function renderTour(initialEntry = '/') {
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

async function start() {
  fireEvent.click(await screen.findByTestId('start'))
  return screen.findByTestId('tour-popover')
}

async function stepShown(id: string) {
  await waitFor(() =>
    expect(screen.getByTestId('tour-popover').getAttribute('data-tour-step')).toBe(id),
  )
}

beforeEach(() => {
  showRoundCard = true
  setSession(participant, 'tok')
  mockedPractice.mockReset()
  mockedPractice.mockResolvedValue(jsonResponse(200, [{ id: 'p1', title: 'P1' }]))
  mockedMark.mockReset()
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  clearSession('manual')
  await i18n.changeLanguage('pt')
})

describe('TourProvider', () => {
  it('opens on step 1 of 6 with Back disabled and the header highlighted', async () => {
    renderTour()
    await start()
    await stepShown('header')

    expect(screen.getByTestId('tour-step-indicator').textContent).toBe('Passo 1 de 6')
    expect(screen.getByTestId('tour-prev')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('tour-next')).toHaveProperty('disabled', false)
    expect(screen.getByTestId('language-selector').hasAttribute('data-tour-highlight')).toBe(true)
  })

  it('moves forward and back, following the indicator and the routes', async () => {
    const router = renderTour()
    await start()
    await stepShown('header')

    fireEvent.click(screen.getByTestId('tour-next'))
    await stepShown('round')
    expect(screen.getByTestId('tour-prev')).toHaveProperty('disabled', false)
    expect(screen.getByTestId('language-selector').hasAttribute('data-tour-highlight')).toBe(false)
    expect(screen.getByTestId('home-round-card').hasAttribute('data-tour-highlight')).toBe(true)

    fireEvent.click(screen.getByTestId('tour-next'))
    await stepShown('teams')
    expect(router.state.location.pathname).toBe('/teams')
    expect(screen.getByTestId('tour-step-indicator').textContent).toBe('Passo 3 de 6')

    fireEvent.click(screen.getByTestId('tour-prev'))
    await stepShown('round')
    expect(router.state.location.pathname).toBe('/')
  })

  it('opens the first practice problem for the editor step', async () => {
    const router = renderTour()
    await start()
    for (const id of ['header', 'round', 'teams']) {
      await stepShown(id)
      fireEvent.click(screen.getByTestId('tour-next'))
    }
    await stepShown('editor')

    expect(router.state.location.pathname).toBe('/practice/p1')
    expect(screen.getByTestId('problem-workspace-panel').hasAttribute('data-tour-highlight')).toBe(
      true,
    )
  })

  it('falls back to the practice list when there is no practice problem', async () => {
    mockedPractice.mockResolvedValue(jsonResponse(200, []))
    const router = renderTour()
    await start()
    for (const id of ['header', 'round', 'teams']) {
      await stepShown(id)
      fireEvent.click(screen.getByTestId('tour-next'))
    }
    await stepShown('editor')

    expect(router.state.location.pathname).toBe('/practice')
    expect(screen.getByTestId('practice-empty').hasAttribute('data-tour-highlight')).toBe(true)
  })

  it('walks all six steps and finishes back where it started, calling no write', async () => {
    const router = renderTour('/leaderboard?tab=event')
    await start()
    for (const id of ['header', 'round', 'teams', 'editor', 'leaderboard']) {
      await stepShown(id)
      fireEvent.click(screen.getByTestId('tour-next'))
    }
    await stepShown('practice')
    expect(screen.queryByTestId('tour-next')).toBeNull()

    fireEvent.click(screen.getByTestId('tour-finish'))

    await waitFor(() => expect(screen.queryByTestId('tour-popover')).toBeNull())
    await waitFor(() => expect(router.state.location.href).toBe('/leaderboard?tab=event'))
    expect(document.querySelector('[data-tour-highlight]')).toBeNull()
    expect(mockedMark).not.toHaveBeenCalled()
  })

  it('exiting on step 3 returns to the origin screen, search included', async () => {
    const router = renderTour('/leaderboard?tab=event')
    await start()
    await stepShown('header')
    fireEvent.click(screen.getByTestId('tour-next'))
    await stepShown('round')
    fireEvent.click(screen.getByTestId('tour-next'))
    await stepShown('teams')

    fireEvent.click(screen.getByTestId('tour-exit'))

    await waitFor(() => expect(router.state.location.href).toBe('/leaderboard?tab=event'))
    expect(screen.queryByTestId('tour-popover')).toBeNull()
    expect(document.querySelector('[data-tour-highlight]')).toBeNull()
  })

  it('Escape exits the tour too', async () => {
    const router = renderTour('/teams')
    await start()
    await stepShown('header')
    expect(router.state.location.pathname).toBe('/')

    fireEvent.keyDown(screen.getByTestId('tour-popover'), { key: 'Escape' })

    await waitFor(() => expect(router.state.location.pathname).toBe('/teams'))
    expect(screen.queryByTestId('tour-popover')).toBeNull()
  })

  it('opens centered, without a highlight, when a target never shows up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    showRoundCard = false
    renderTour()
    await start()
    await stepShown('header')
    fireEvent.click(screen.getByTestId('tour-next'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOUR_TARGET_TIMEOUT_MS)
    })

    await stepShown('round')
    expect(document.querySelector('[data-tour-highlight]')).toBeNull()
    expect(screen.getByTestId('tour-next')).toHaveProperty('disabled', false)
  })

  it('switching language translates the step and keeps it', async () => {
    renderTour()
    await start()
    await stepShown('header')
    fireEvent.click(screen.getByTestId('tour-next'))
    await stepShown('round')

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(screen.getByTestId('tour-step-indicator').textContent).toBe('Step 2 of 6')
    expect(screen.getByTestId('tour-step-title').textContent).toBe('The round')
    expect(screen.getByTestId('tour-popover').getAttribute('data-tour-step')).toBe('round')
  })

  it('restarting on step 1 (the user menu while the tour is open) shows step 1 again', async () => {
    const router = renderTour()
    await start()
    await stepShown('header')

    fireEvent.click(screen.getByTestId('start'))

    await stepShown('header')
    expect(screen.getByTestId('language-selector').hasAttribute('data-tour-highlight')).toBe(true)
    // Still a live tour: leaving on their own still ends it.
    await act(async () => {
      await router.navigate({ to: '/elsewhere' as '/' })
    })
    await waitFor(() => expect(screen.queryByTestId('tour-popover')).toBeNull())
  })

  it('ends where the user went when they navigate away on their own', async () => {
    const router = renderTour()
    await start()
    await stepShown('header')

    await act(async () => {
      await router.navigate({ to: '/elsewhere' as '/' })
    })

    await waitFor(() => expect(screen.queryByTestId('tour-popover')).toBeNull())
    expect(router.state.location.pathname).toBe('/elsewhere')
  })
})
