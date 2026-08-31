import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'

import { routeTree } from '@/routeTree.gen'

function renderHome(initialEntry = '/') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

afterEach(() => {
  cleanup()
})

describe('Home', () => {
  it('does not show the notice banner by default', async () => {
    renderHome()

    await waitFor(() => expect(screen.getByTestId('api-status')).toBeDefined())
    expect(screen.queryByTestId('home-notice-banner')).toBeNull()
  })

  it('shows the forbidden-organizer notice and dismisses it, clearing the search param', async () => {
    const router = renderHome('/?notice=forbidden-organizer')

    await waitFor(() => expect(screen.getByTestId('home-notice-banner')).toBeDefined())

    fireEvent.click(screen.getByTestId('home-notice-dismiss'))

    await waitFor(() => expect(screen.queryByTestId('home-notice-banner')).toBeNull())
    expect(router.state.location.search).toEqual({})
  })
})
