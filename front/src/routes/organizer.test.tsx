import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({ api: {} }))
vi.mock('@/lib/sse-client', () => ({ connectEventStream: vi.fn(() => () => {}) }))

import i18n from '@/i18n'
import { OrganizerScreen } from '@/routes/organizer'

const TAB_TESTIDS = [
  'organizer-nav-overview',
  'organizer-nav-problems',
  'organizer-nav-rounds',
  'organizer-nav-event-config',
  'organizer-nav-teams',
  'organizer-nav-users',
] as const

// The shell is mounted on a route tree of its own instead of `routeTree.gen`
// (the `header.test.tsx` recipe): the real tree drags every organizer child
// screen — and the authenticated queries each one fires — into a test that
// only asserts the chrome. Every `<Link to>` destination still needs a route
// here, because TanStack resolves the href against the tree.
const rootRoute = createRootRoute({ component: OrganizerScreen })
const routeTree = rootRoute.addChildren(
  [
    '/organizer',
    '/organizer/problems',
    '/organizer/rounds',
    '/organizer/event-config',
    '/organizer/teams',
    '/organizer/users',
  ].map((path) => createRoute({ getParentRoute: () => rootRoute, path, component: () => null })),
)

async function renderShell(initialEntry = '/organizer') {
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
  // RouterProvider resolves its first match asynchronously; without this the
  // body is still empty when the assertions run.
  await screen.findByTestId('organizer-heading')
}

beforeEach(async () => {
  await i18n.changeLanguage('pt')
})

afterEach(async () => {
  cleanup()
  // i18n is a module singleton: a test that switches language would otherwise
  // leak Spanish into every PT assertion that follows.
  await i18n.changeLanguage('pt')
})

describe('organizer shell', () => {
  it('renders the heading in the display face and all six tabs', async () => {
    await renderShell()

    const heading = screen.getByTestId('organizer-heading')
    expect(heading.tagName).toBe('H1')
    expect(heading.className).toContain('font-display')
    expect(heading.className).toContain('uppercase')

    for (const testId of TAB_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeTruthy()
    }
  })

  it('gives the tab bar an accessible name and lets it wrap instead of scrolling', async () => {
    await renderShell()

    const nav = screen.getByRole('navigation', { name: 'Seções do painel' })
    expect(nav.className).toContain('flex-wrap')
    // Identity § 5: below 768px the tabs break onto two lines — they never
    // scroll sideways and never swap for another component.
    expect(nav.className).not.toContain('overflow-x')
    expect(nav.className).not.toContain('flex-nowrap')
  })

  it.each([
    ['/organizer', 'organizer-nav-overview'],
    ['/organizer/problems', 'organizer-nav-problems'],
    ['/organizer/rounds', 'organizer-nav-rounds'],
    ['/organizer/event-config', 'organizer-nav-event-config'],
    ['/organizer/teams', 'organizer-nav-teams'],
    ['/organizer/users', 'organizer-nav-users'],
  ])('underlines only the active tab at %s', async (path, activeTestId) => {
    await renderShell(path)

    for (const testId of TAB_TESTIDS) {
      const tab = screen.getByTestId(testId)
      // The 2px rule sits on the item, not on the <nav>, so it follows the
      // active tab onto the second row once the bar wraps.
      expect(tab.className).toContain('border-b-2')
      if (testId === activeTestId) {
        expect(tab.className).toContain('border-brand')
        expect(tab.className).toContain('text-foreground')
      } else {
        expect(tab.className).toContain('border-transparent')
        expect(tab.className).not.toContain('border-brand')
      }
    }
  })

  it('keeps the overview tab inactive on child routes', async () => {
    await renderShell('/organizer/users')

    // `activeOptions={{ exact: true }}`: without it the index link would stay
    // active on every child route, since they all sit under /organizer.
    expect(screen.getByTestId('organizer-nav-overview').className).toContain('border-transparent')
  })
})
