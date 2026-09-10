import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Header } from '@/components/header'
import i18n from '@/i18n'

import { clearSession, getState, type SessionUser, setSession } from '@/lib/session'

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// The header is exercised against a route tree of its own, not `routeTree.gen`
// (#168). Mounting the real tree pulled in whole screens — the home page alone
// fires several authenticated queries plus the SSE stream — so the test spent
// its time on other people's components and, worse, on the network: a real 401
// dropped the session and bounced the router to /login mid-assertion, which is
// what made this file depend on its position in the suite.
//
// Every destination the header links to needs a route here: TanStack Router
// resolves `<Link to>` against the tree, and a missing path breaks the `href`.
// Nothing asserted below — pathname, `aria-current`, the Link classes — needs
// the real screens.
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
    </>
  ),
})
const routeTree = rootRoute.addChildren(
  [
    '/',
    '/login',
    '/signup',
    '/teams',
    '/leaderboard',
    '/change-password',
    '/organizer/problems',
  ].map((path) => createRoute({ getParentRoute: () => rootRoute, path, component: () => null })),
)

function renderHeader(initialEntry = '/login') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  clearSession('manual')
})

afterEach(async () => {
  cleanup()
  clearSession('manual')
  // i18n is a module singleton: a test that switches language would otherwise
  // leak English/Spanish into every PT assertion that follows.
  await i18n.changeLanguage('pt')
})

describe('Header', () => {
  it('shows login/signup links when anonymous', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(screen.getByTestId('header-signup-link')).toBeDefined()
    expect(screen.queryByTestId('header-user-email')).toBeNull()
    expect(screen.queryByTestId('header-logout-button')).toBeNull()
  })

  it('shows the user email and a logout button when authenticated', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-user-email')).toBeDefined())
    expect(screen.getByTestId('header-user-email').textContent).toBe('ada@edu.pucrs.br')
    expect(screen.queryByTestId('header-login-link')).toBeNull()
    expect(screen.queryByTestId('header-signup-link')).toBeNull()
  })

  it('does not show the organizer link for a participant', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-user-email')).toBeDefined())
    expect(screen.queryByTestId('header-organizer-link')).toBeNull()
  })

  it('shows the organizer link for an organizer', async () => {
    setSession({ ...fakeUser, role: 'organizer' }, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-organizer-link')).toBeDefined())
  })

  it('shows the teams link to any authenticated user', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-teams-link')).toBeDefined())
  })

  it('hides the teams link while anonymous', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(screen.queryByTestId('header-teams-link')).toBeNull()
  })

  it('shows the leaderboard link to any authenticated user', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-leaderboard-link')).toBeDefined())
  })

  it('hides the leaderboard link while anonymous', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(screen.queryByTestId('header-leaderboard-link')).toBeNull()
  })

  it('clears the session and navigates home on logout', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderHeader()
    await waitFor(() => expect(screen.getByTestId('header-logout-button')).toBeDefined())

    fireEvent.click(screen.getByTestId('header-logout-button'))

    expect(getState().status).toBe('anonymous')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
  })
})

// TanStack Router tags the matching Link with a bare `active` class. Nothing
// in the stylesheet defines `.active`, so it is an inert marker — drop it to
// compare the classes that actually paint the wordmark.
function styleClassesOf(el: HTMLElement) {
  return [...el.classList].filter((c) => c !== 'active').sort()
}

describe('Header home link', () => {
  it('renders the wordmark as a link to the home page while anonymous', async () => {
    renderHeader('/login')

    const link = await screen.findByTestId('header-home-link')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/')
    expect(link.getAttribute('aria-label')).toBe('kumite — página inicial')
    expect(link.textContent).toBe('kumite')
  })

  it('navigates to the home page through the router when clicked', async () => {
    const router = renderHeader('/login')
    const link = await screen.findByTestId('header-home-link')

    fireEvent.click(link)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('shows the same home link to an authenticated participant', async () => {
    setSession(fakeUser, 'tok-1')
    const router = renderHeader('/teams')

    const link = await screen.findByTestId('header-home-link')
    expect(link.getAttribute('href')).toBe('/')

    fireEvent.click(link)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('shows the same home link to an organizer', async () => {
    setSession({ ...fakeUser, role: 'organizer' }, 'tok-1')
    const router = renderHeader('/organizer/problems')

    const link = await screen.findByTestId('header-home-link')
    expect(link.getAttribute('href')).toBe('/')

    fireEvent.click(link)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('stays on the home page, with no special visual state, when already there', async () => {
    const router = renderHeader('/')
    const link = await screen.findByTestId('header-home-link')
    const classesOnHome = styleClassesOf(link)

    fireEvent.click(link)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    const stillThere = screen.getByTestId('header-home-link')
    expect(styleClassesOf(stillThere)).toEqual(classesOnHome)
    // The router's own current-page semantics stay on; nothing else changes.
    expect(stillThere.getAttribute('aria-current')).toBe('page')
  })

  it('keeps the same look on the home page as anywhere else', async () => {
    renderHeader('/')
    const onHome = styleClassesOf(await screen.findByTestId('header-home-link'))
    cleanup()

    renderHeader('/login')
    const elsewhere = styleClassesOf(await screen.findByTestId('header-home-link'))

    // Only the router's own current-page semantics differ; the wordmark itself
    // never gains a styling class of its own.
    expect(onHome).toEqual(elsewhere)
    expect(screen.getByTestId('header-home-link').getAttribute('aria-current')).toBeNull()
  })

  it('translates the accessible label into the active language', async () => {
    renderHeader('/login')
    await screen.findByTestId('header-home-link')

    await i18n.changeLanguage('es')
    await waitFor(() =>
      expect(screen.getByTestId('header-home-link').getAttribute('aria-label')).toBe(
        'kumite — página de inicio',
      ),
    )

    await i18n.changeLanguage('en')
    await waitFor(() =>
      expect(screen.getByTestId('header-home-link').getAttribute('aria-label')).toBe(
        'kumite — home',
      ),
    )

    expect(screen.getByTestId('header-home-link').textContent).toBe('kumite')
  })

  it('navigates without asking for confirmation', async () => {
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)

    try {
      const router = renderHeader('/login')
      const link = await screen.findByTestId('header-home-link')

      fireEvent.click(link)

      await waitFor(() => expect(router.state.location.pathname).toBe('/'))
      expect(confirmSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
