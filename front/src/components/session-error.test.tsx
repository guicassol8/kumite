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

// The card drives the session store, so the store is what gets stubbed: the
// real one would reach `/me` through the hc client and trip the jsdom network
// guard. `useNavigate` still needs a real router around the component, which
// is why this mounts a tiny tree of its own (front/AGENTS.md).
vi.mock('@/lib/session', () => ({
  clearSession: vi.fn(),
  retryHydration: vi.fn(async () => {}),
}))

import { SessionErrorScreen } from '@/components/session-error'
import i18n from '@/i18n'
import { clearSession, retryHydration } from '@/lib/session'

const mockedRetry = vi.mocked(retryHydration)
const mockedClear = vi.mocked(clearSession)

const rootRoute = createRootRoute({
  component: () => (
    <>
      <SessionErrorScreen />
      <Outlet />
    </>
  ),
})
const routeTree = rootRoute.addChildren(
  ['/', '/teams'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  ),
)

function renderCard(initialEntry = '/teams') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  mockedRetry.mockReset()
  mockedRetry.mockResolvedValue(undefined)
  mockedClear.mockReset()
})

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('SessionErrorScreen (#179)', () => {
  it('explains the failure and offers both ways out', async () => {
    renderCard()

    await waitFor(() => expect(screen.getByTestId('session-error-card')).toBeDefined())
    expect(screen.getByTestId('session-error-retry')).toBeDefined()
    expect(screen.getByTestId('session-error-sign-out')).toBeDefined()
  })

  it('retries in place instead of asking for an F5', async () => {
    renderCard()
    await waitFor(() => expect(screen.getByTestId('session-error-retry')).toBeDefined())

    fireEvent.click(screen.getByTestId('session-error-retry'))

    await waitFor(() => expect(mockedRetry).toHaveBeenCalledTimes(1))
  })

  // The automatic attempts are silent; this is the only feedback the user gets
  // that the button did something, and double-clicking it must not stack two
  // hydration cycles.
  it('disables the button and says so while an attempt is in flight', async () => {
    let release = () => {}
    mockedRetry.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    renderCard()
    const button = await waitFor(() => screen.getByTestId('session-error-retry'))

    fireEvent.click(button)

    await waitFor(() => expect(button.textContent).toBe(i18n.t('session.error.retrying')))
    expect((button as HTMLButtonElement).disabled).toBe(true)

    release()
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  })

  it('signs out and leaves the guarded route on the emergency exit', async () => {
    const router = renderCard('/teams')
    await waitFor(() => expect(screen.getByTestId('session-error-sign-out')).toBeDefined())

    fireEvent.click(screen.getByTestId('session-error-sign-out'))

    expect(mockedClear).toHaveBeenCalledWith('manual')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('translates into the active language', async () => {
    await i18n.changeLanguage('en')
    renderCard()

    await waitFor(() =>
      expect(screen.getByTestId('session-error-retry').textContent).toBe('Try again'),
    )
  })
})
