import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NotFoundScreen } from '@/components/not-found-screen'
import i18n from '@/i18n'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
})
const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <div>home</div> }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/rota-que-nao-existe',
    component: NotFoundScreen,
  }),
])

function renderScreen(initialEntry = '/rota-que-nao-existe') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('NotFoundScreen (#230)', () => {
  it('shows the card, in Portuguese by default, with a link back home', async () => {
    renderScreen()

    await waitFor(() => expect(screen.getByTestId('not-found-card')).toBeDefined())
    expect(screen.getByText('Página não encontrada')).toBeDefined()
    expect(screen.getByText('Esse endereço não existe no kumite.')).toBeDefined()
    expect(screen.getByTestId('not-found-home-link')).toBeDefined()
  })

  it('sends the visitor home when the link is clicked', async () => {
    const router = renderScreen()
    await waitFor(() => expect(screen.getByTestId('not-found-home-link')).toBeDefined())

    fireEvent.click(screen.getByTestId('not-found-home-link'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('translates into the active language', async () => {
    await i18n.changeLanguage('es')
    renderScreen()

    await waitFor(() => expect(screen.getByText('Página no encontrada')).toBeDefined())
    expect(screen.getByText('Esa dirección no existe en kumite.')).toBeDefined()
  })
})
