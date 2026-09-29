import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    health: { $get: vi.fn() },
  },
}))

import i18n from '@/i18n'
import { api } from '@/lib/api'
import { setPresentationActive } from '@/lib/presentation-mode'
import { Footer } from './footer'

const mockedHealth = vi.mocked(api.health.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

// The footer links to /how-it-works (#213), so it needs a router — a minimal
// tree of its own, as in header.test.tsx, loaded before the first render so
// the synchronous assertions below still see the footer at once.
async function renderFooter() {
  const rootRoute = createRootRoute({ component: () => <Footer /> })
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  mockedHealth.mockReset()
})

afterEach(async () => {
  cleanup()
  setPresentationActive(false)
  await i18n.changeLanguage('pt')
})

describe('Footer', () => {
  it('renders the footer container', async () => {
    mockedHealth.mockReturnValue(new Promise(() => {}))
    await renderFooter()

    expect(screen.getByTestId('app-footer')).toBeDefined()
  })

  it('exposes the contact address as a mailto link', async () => {
    mockedHealth.mockReturnValue(new Promise(() => {}))
    await renderFooter()

    const link = screen.getByTestId('footer-contact-email')
    expect(link.getAttribute('href')).toBe('mailto:ligadealgoritmos@gmail.com')
    expect(link.textContent).toBe('ligadealgoritmos@gmail.com')
  })

  it('shows the symbol and the event name', async () => {
    mockedHealth.mockReturnValue(new Promise(() => {}))
    await renderFooter()

    expect(screen.getByTestId('app-footer').textContent).toContain('PUCRS × Mérida 2026')
  })

  it.each([
    ['pt', 'Dúvidas? Fale com a organização:'],
    ['es', '¿Dudas? Habla con la organización:'],
    ['en', 'Questions? Talk to the organizers:'],
  ])('shows the contact label translated in %s, address unchanged', async (language, label) => {
    mockedHealth.mockReturnValue(new Promise(() => {}))
    await i18n.changeLanguage(language)
    await renderFooter()

    expect(screen.getByTestId('app-footer').textContent).toContain(label)
    expect(screen.getByTestId('footer-contact-email').textContent).toBe(
      'ligadealgoritmos@gmail.com',
    )
  })
})

describe('Footer — Como funciona (#213)', () => {
  it.each([
    ['pt', 'Como funciona'],
    ['es', 'Cómo funciona'],
    ['en', 'How it works'],
  ])('links to /how-it-works, labelled in %s', async (language, label) => {
    mockedHealth.mockReturnValue(new Promise(() => {}))
    await i18n.changeLanguage(language)
    const router = await renderFooter()

    const link = screen.getByTestId('footer-how-it-works-link')
    expect(link.textContent).toBe(label)
    fireEvent.click(link)
    await waitFor(() => expect(router.state.location.pathname).toBe('/how-it-works'))
  })
})

describe('Footer — API status indicator (#217)', () => {
  it('shows the loading state while the health check is pending', async () => {
    mockedHealth.mockReturnValue(new Promise(() => {}))
    await renderFooter()

    expect(screen.getByTestId('api-status-loading').textContent).toBe('Conectando')
    expect(screen.queryByTestId('api-status-ok')).toBeNull()
    expect(screen.queryByTestId('api-status-error')).toBeNull()
  })

  it('shows the short "connected" label once the health check resolves', async () => {
    mockedHealth.mockResolvedValue(jsonResponse(200, { status: 'ok' }))
    await renderFooter()

    await waitFor(() => expect(screen.getByTestId('api-status-ok')).toBeDefined())
    expect(screen.getByTestId('api-status-ok').textContent).toBe('Conectado')
    expect(screen.queryByTestId('api-status-loading')).toBeNull()
  })

  it('shows the short "no connection" label when the health check fails', async () => {
    mockedHealth.mockResolvedValue(jsonResponse(500, {}))
    await renderFooter()

    await waitFor(() => expect(screen.getByTestId('api-status-error')).toBeDefined())
    expect(screen.getByTestId('api-status-error').textContent).toBe('Sem conexão')
  })

  it.each([
    ['es', 'Conectado', 'Sin conexión', 'Conectando'],
    ['en', 'Connected', 'No connection', 'Connecting'],
  ])('translates the status labels in %s', async (language, connected, error, connecting) => {
    await i18n.changeLanguage(language)

    mockedHealth.mockReturnValue(new Promise(() => {}))
    await renderFooter()
    expect(screen.getByTestId('api-status-loading').textContent).toBe(connecting)
    cleanup()

    mockedHealth.mockResolvedValue(jsonResponse(200, { status: 'ok' }))
    await renderFooter()
    await waitFor(() => expect(screen.getByTestId('api-status-ok').textContent).toBe(connected))
    cleanup()

    mockedHealth.mockResolvedValue(jsonResponse(500, {}))
    await renderFooter()
    await waitFor(() => expect(screen.getByTestId('api-status-error').textContent).toBe(error))
  })
})

describe('Footer — telão (#220)', () => {
  it('renders nothing while presentation mode is active', async () => {
    setPresentationActive(true)
    const { container } = render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Footer />
      </QueryClientProvider>,
    )
    expect(container.firstChild).toBeNull()
  })
})
