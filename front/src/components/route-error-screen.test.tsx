import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RouteErrorScreen } from '@/components/route-error-screen'
import i18n from '@/i18n'

// Link (`to="/"`) needs a real router underneath, same reason session-error's
// suite mounts one (front/AGENTS.md) — a plain render() throws without it.
function renderWithRouter(error: Error, reset: () => void) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <RouteErrorScreen error={error} reset={reset} />
        <Outlet />
      </>
    ),
  })
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <div>home</div> }),
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await i18n.changeLanguage('pt')
})

describe('RouteErrorScreen (#230)', () => {
  it('shows the card and both actions, in Portuguese by default', async () => {
    renderWithRouter(new Error('segredo-do-stack'), vi.fn())

    await waitFor(() => expect(screen.getByTestId('route-error-card')).toBeDefined())
    expect(screen.getByText('Algo deu errado')).toBeDefined()
    expect(screen.getByText('Não foi possível exibir esta tela.')).toBeDefined()
    expect(screen.getByTestId('route-error-retry')).toBeDefined()
    expect(screen.getByTestId('route-error-home-link')).toBeDefined()
  })

  // Acceptance (#230): "sem expor stack trace ao participante" — nothing about
  // the thrown error may reach the DOM, in any environment.
  it('never renders the error message or its stack', async () => {
    renderWithRouter(new Error('segredo-do-stack'), vi.fn())

    await waitFor(() => expect(screen.getByTestId('route-error-card')).toBeDefined())
    expect(document.body.textContent).not.toContain('segredo-do-stack')
    expect(document.body.textContent).not.toContain('at ')
  })

  it('logs the error to the console for diagnosis, without showing it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('segredo-do-stack')

    renderWithRouter(error, vi.fn())

    await waitFor(() => expect(spy).toHaveBeenCalledWith(error))
  })

  it('calls reset() when the retry button is clicked', async () => {
    const reset = vi.fn()
    renderWithRouter(new Error('boom'), reset)
    await waitFor(() => expect(screen.getByTestId('route-error-retry')).toBeDefined())

    fireEvent.click(screen.getByTestId('route-error-retry'))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('translates into the active language', async () => {
    await i18n.changeLanguage('en')
    renderWithRouter(new Error('boom'), vi.fn())

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeDefined())
    expect(screen.getByTestId('route-error-retry').textContent).toBe('Try again')
  })
})
