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
  },
}))

import { TourProvider } from '@/components/onboarding/tour-provider'
import i18n from '@/i18n'
import { clearSession, type SessionUser, setSession } from '@/lib/session'

import { Route as HowItWorksRoute } from './how-it-works'

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

const SECTIONS = ['what', 'teams', 'rounds', 'editor', 'practice']

// A minimal tree (header.test.tsx's pattern): the screen itself, the tour
// around it, and stand-ins for where its links and the tour's first step go.
async function renderScreen() {
  const Screen = HowItWorksRoute.options.component
  if (!Screen) throw new Error('expected the route to have a component')
  const rootRoute = createRootRoute({
    component: () => (
      <TourProvider>
        <div data-testid="language-selector" />
        <Outlet />
      </TourProvider>
    ),
  })
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/how-it-works', component: Screen }),
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => null }),
    createRoute({ getParentRoute: () => rootRoute, path: '/practice', component: () => null }),
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/how-it-works'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  clearSession('manual')
})

afterEach(async () => {
  cleanup()
  clearSession('manual')
  await i18n.changeLanguage('pt')
})

describe('/how-it-works', () => {
  it.each([
    ['pt', 'Como funciona', 'Rodadas e pontuação'],
    ['es', 'Cómo funciona', 'Rondas y puntuación'],
    ['en', 'How it works', 'Rounds and scoring'],
  ])('is public and explains the event in %s', async (language, title, roundsTitle) => {
    await act(async () => {
      await i18n.changeLanguage(language)
    })
    await renderScreen()

    const screenEl = await screen.findByTestId('how-it-works-screen')
    expect(screenEl.querySelector('h1')?.textContent).toBe(title)
    for (const id of SECTIONS) {
      const section = screen.getByTestId(`how-it-works-section-${id}`)
      expect(section.querySelector('h2')?.textContent).toMatch(/\S/)
      expect(section.querySelector('p')?.textContent).toMatch(/\S/)
    }
    expect(screen.getByTestId('how-it-works-section-rounds').querySelector('h2')?.textContent).toBe(
      roundsTitle,
    )
  })

  it('offers neither the tour nor practice to an anonymous reader', async () => {
    await renderScreen()

    await screen.findByTestId('how-it-works-screen')
    expect(screen.queryByTestId('how-it-works-start-tour')).toBeNull()
    expect(screen.queryByTestId('how-it-works-practice-link')).toBeNull()
  })

  it('lets a signed-in user start the tour, or go practice', async () => {
    setSession(participant, 'tok-1')
    const router = await renderScreen()

    expect((await screen.findByTestId('how-it-works-practice-link')).getAttribute('href')).toBe(
      '/practice',
    )

    fireEvent.click(screen.getByTestId('how-it-works-start-tour'))

    const popover = await screen.findByTestId('tour-popover')
    await waitFor(() => expect(popover.getAttribute('data-tour-step')).toBe('header'))

    fireEvent.click(screen.getByTestId('tour-exit'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/how-it-works'))
  })
})
