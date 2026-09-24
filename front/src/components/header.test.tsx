import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    rounds: Object.assign(vi.fn(), { $get: vi.fn() }),
  },
}))

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import { Header } from '@/components/header'
import { RoundStreamProvider } from '@/hooks/use-round-stream'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { setPresentationActive } from '@/lib/presentation-mode'
import { clearSession, getState, retryHydration, type SessionUser, setSession } from '@/lib/session'
import type { SseEvent } from '@/lib/sse-schema'
import { setTheme } from '@/lib/theme'

const mockedRounds = vi.mocked(api.rounds.$get)

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  name: 'Ada Lovelace',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RoundStreamProvider>
        <RouterProvider router={router} />
      </RoundStreamProvider>
    </QueryClientProvider>,
  )
  return router
}

// This file renders whole routes (the home screen fires several authenticated
// queries) and is the only one that does not stub `@/lib/api`, so without this
// the real `fetch` runs: a 401 on a request carrying our Authorization header
// makes authFetch call clearSession('expired'), and __root bounces the router
// to /login. Landing before or after an assertion was pure timing, which is
// why "stays on the home page" passed in a full run and failed on its own.
// Discovered from #122.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ),
  )
  clearSession('manual')
  mockedRounds.mockReset()
  mockedRounds.mockResolvedValue(jsonResponse(200, []))
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(() => {})
  localStorage.clear()
  document.documentElement.className = ''
  setTheme('system')
  localStorage.clear()
})

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  clearSession('manual')
  localStorage.clear()
  document.documentElement.className = ''
  setPresentationActive(false)
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

  it('shows the user name and a logout button when authenticated', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-user-email')).toBeDefined())
    expect(screen.getByTestId('header-user-email').textContent).toBe('Ada Lovelace')
    expect(screen.queryByTestId('header-login-link')).toBeNull()
    expect(screen.queryByTestId('header-signup-link')).toBeNull()
  })

  // An account created before the #122 migration has no name — the same slot
  // falls back to the email rather than rendering nothing.
  it('falls back to the email for a user with no name', async () => {
    setSession({ ...fakeUser, name: null }, 'tok-1')
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-user-email')).toBeDefined())
    expect(screen.getByTestId('header-user-email').textContent).toBe('ada@edu.pucrs.br')
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

describe('Header — user menu (#217)', () => {
  it('shows name and email at the top and a single change-password action', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    // A plain fireEvent.click does not open Radix's DropdownMenu in jsdom —
    // its trigger opens on pointerdown/keyboard activation, and jsdom has no
    // pointer-capture implementation for `fireEvent.pointerDown` to drive.
    // Keyboard activation (Enter) is the interaction jsdom supports without
    // pulling in @testing-library/user-event.
    const trigger = await screen.findByTestId('header-user-menu-trigger')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Ada Lovelace')).toBeDefined()
    expect(within(menu).getByText('ada@edu.pucrs.br')).toBeDefined()
    const changePassword = within(menu).getByTestId('header-change-password-link')
    expect(changePassword.getAttribute('href')).toBe('/change-password')
  })

  it('keeps language, theme and logout on the bar, not inside the menu', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    const trigger = await screen.findByTestId('header-user-menu-trigger')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const menu = await screen.findByRole('menu')

    expect(within(menu).queryByTestId('language-selector')).toBeNull()
    expect(within(menu).queryByTestId('header-theme-toggle')).toBeNull()
    expect(within(menu).queryByTestId('header-logout-button')).toBeNull()
    expect(screen.getByTestId('language-selector')).toBeDefined()
    expect(screen.getByTestId('header-theme-toggle')).toBeDefined()
    expect(screen.getByTestId('header-logout-button')).toBeDefined()
  })
})

describe('Header — live round chip (#217)', () => {
  it('is hidden with no open round and appears once state.sync reports one', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()
    await waitFor(() => expect(connectEventStream).toHaveBeenCalledTimes(1))

    expect(screen.queryByTestId('header-round-chip')).toBeNull()

    emitSse({
      type: 'state.sync',
      submissionsPaused: false,
      serverTime: new Date('2026-09-02T12:00:00.000Z'),
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })

    await waitFor(() => expect(screen.getByTestId('header-round-chip')).toBeDefined())
  })

  it('disappears again when the round closes', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()
    await waitFor(() => expect(connectEventStream).toHaveBeenCalledTimes(1))

    emitSse({
      type: 'round.opened',
      serverTime: new Date('2026-09-02T12:00:00.000Z'),
      roundId: 'r1',
      closesAt: new Date('2026-09-02T12:30:00.000Z'),
    })
    await waitFor(() => expect(screen.getByTestId('header-round-chip')).toBeDefined())

    emitSse({
      type: 'round.closed',
      serverTime: new Date('2026-09-02T12:30:00.000Z'),
      roundId: 'r1',
    })

    await waitFor(() => expect(screen.queryByTestId('header-round-chip')).toBeNull())
  })

  it('does not render for an anonymous visitor', async () => {
    renderHeader()

    await waitFor(() => expect(screen.getByTestId('header-login-link')).toBeDefined())
    expect(connectEventStream).not.toHaveBeenCalled()
    expect(screen.queryByTestId('header-round-chip')).toBeNull()
  })
})

describe('Header — theme toggle (#217)', () => {
  it('alternates the resolved theme and persists the choice', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    const toggle = await screen.findByTestId('header-theme-toggle')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(toggle)
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))

    fireEvent.click(toggle)
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(false))
  })

  it('is reachable while anonymous', async () => {
    renderHeader()

    expect(await screen.findByTestId('header-theme-toggle')).toBeDefined()
  })
})

describe('Header — bug report trigger (#217)', () => {
  it('opens the dialog from the desktop icon trigger', async () => {
    renderHeader()

    const trigger = await screen.findByTestId('header-bug-report-trigger')
    fireEvent.click(trigger)

    expect(await screen.findByTestId('bug-report-dialog')).toBeDefined()
  })

  // The mobile row is a plain button (#217), not a nested `<DialogTrigger>`
  // — it lives inside the Sheet, which is built on the same Radix Dialog
  // primitive, so a trigger nested in there would bind to the Sheet's own
  // context instead of the bug-report dialog's. Clicking it closes the
  // sheet and opens the same controlled dialog the desktop icon opens.
  it('closes the menu panel and opens the dialog from the mobile row', async () => {
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))
    fireEvent.click(await screen.findByTestId('header-mobile-bug-report-trigger'))

    expect(await screen.findByTestId('bug-report-dialog')).toBeDefined()
    expect(screen.queryByTestId('header-mobile-user-block')).toBeNull()
  })

  it('shares one dialog and draft between the desktop and mobile triggers', async () => {
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-bug-report-trigger'))
    fireEvent.change(await screen.findByTestId('bug-report-description'), {
      target: { value: 'rascunho compartilhado' },
    })
    fireEvent.click(screen.getByTestId('bug-report-cancel'))
    await waitFor(() => expect(screen.queryByTestId('bug-report-dialog')).toBeNull())

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))
    fireEvent.click(await screen.findByTestId('header-mobile-bug-report-trigger'))

    expect(await screen.findByTestId<HTMLTextAreaElement>('bug-report-description')).toHaveProperty(
      'value',
      'rascunho compartilhado',
    )
  })
})

describe('Header — mobile menu panel (#217, closes #186/#198)', () => {
  it('opens via the single menu trigger and shows Início, Trocar senha, Tema, Reportar bug and Sair', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))
    const panel = await screen.findByTestId('header-mobile-user-block')
    expect(within(panel).getByText('Ada Lovelace')).toBeDefined()

    expect(screen.getByTestId('header-mobile-home-link')).toBeDefined()
    expect(screen.getByTestId('header-mobile-theme-toggle')).toBeDefined()
    expect(screen.getByTestId('header-mobile-bug-report-trigger')).toBeDefined()
    expect(screen.getByTestId('header-mobile-logout-button')).toBeDefined()
    // Both the desktop dropdown item and the mobile panel row share this
    // testid (#217) — only one exists in the DOM at a time because each
    // lives inside its own closed-by-default Radix overlay, and only the
    // mobile Sheet is open here.
    expect(screen.getByTestId('header-change-password-link')).toBeDefined()
  })

  it('does not offer the language selector inside the panel — it stays on the bar at every width', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))
    await screen.findByTestId('header-mobile-user-block')

    // A single instance on the bar, never duplicated inside the panel.
    expect(screen.getAllByTestId('language-selector')).toHaveLength(1)
  })

  it('closes the panel when a nav link is clicked', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))
    await screen.findByTestId('header-mobile-home-link')

    fireEvent.click(screen.getByTestId('header-mobile-home-link'))

    await waitFor(() => expect(screen.queryByTestId('header-mobile-user-block')).toBeNull())
  })

  it('shows only public nav, theme and bug report for an anonymous visitor', async () => {
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))
    const panel = await screen
      .findByTestId('header-mobile-bug-report-trigger')
      .then((el) => el.closest('[role="dialog"]') as HTMLElement)

    // Both the desktop bar and the mobile panel render login/signup with the
    // same testid (#217) — the desktop copy stays in the DOM (jsdom ignores
    // its `hidden md:flex`), so this scopes to the panel that is actually
    // open.
    expect(within(panel).getByTestId('header-login-link')).toBeDefined()
    expect(within(panel).getByTestId('header-signup-link')).toBeDefined()
    expect(screen.getByTestId('header-mobile-theme-toggle')).toBeDefined()
    expect(screen.getByTestId('header-mobile-bug-report-trigger')).toBeDefined()
    expect(screen.queryByTestId('header-mobile-user-block')).toBeNull()
    expect(screen.queryByTestId('header-mobile-logout-button')).toBeNull()
  })
})

// #179: hydration failed, so the header knows nothing about this visitor.
// Showing "Entrar/Cadastrar" would assert they are signed out — which may
// simply be false — and both links lead to screens the error card is covering.
// Real timers: the 0/500/1500ms backoff is what these wait on.
describe('Header while session hydration is in the error state (#179)', () => {
  async function enterErrorState(): Promise<void> {
    setSession(fakeUser, 'tok-1')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await retryHydration()
    expect(getState().status).toBe('error')
  }

  it('offers no auth links and no user block', async () => {
    await enterErrorState()
    renderHeader('/teams')

    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined())
    expect(screen.queryByTestId('header-login-link')).toBeNull()
    expect(screen.queryByTestId('header-signup-link')).toBeNull()
    expect(screen.queryByTestId('header-user-email')).toBeNull()
    expect(screen.queryByTestId('header-logout-button')).toBeNull()
    expect(screen.queryByTestId('header-mobile-menu-trigger')).toBeNull()
  }, 15_000)

  // The two things that still have to work: getting home, and reading the
  // error message in a language the user speaks.
  it('keeps the wordmark and the language selector', async () => {
    await enterErrorState()
    renderHeader('/teams')

    await waitFor(() => expect(screen.getByTestId('header-home-link')).toBeDefined())
    expect(screen.getByTestId('language-selector')).toBeDefined()
  }, 15_000)
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
    // The wordmark is the outlined SVG, which is aria-hidden: the accessible
    // name is bought entirely by the label above, in every language.
    expect(link.querySelector('[data-testid="brand-lockup"]')).not.toBeNull()
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

    expect(
      screen.getByTestId('header-home-link').querySelector('[data-testid="brand-lockup"]'),
    ).not.toBeNull()
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

describe('Header — telão (#220)', () => {
  it('renders nothing while presentation mode is active', async () => {
    setSession(fakeUser, 'tok-1')
    setPresentationActive(true)
    renderHeader('/')

    await waitFor(() => expect(screen.queryByTestId('app-header')).toBeNull())
  })
})

// #271: the logout button composes `variant="outline"` with the header's own
// chrome classes, and two classes of the variant used to survive
// `tailwind-merge` because the header passed no counterpart for them —
// `bg-background` (paper, in the light theme) and `hover:text-accent-foreground`
// (ink). Light label on a paper surface measured 1.0814:1 at rest, 1.3062:1 on
// hover; AA asks for 4.5:1. In the dark theme the same two classes happened to
// resolve to legible colours (16.9:1 and 13.9:1), so this guard is what keeps
// the light theme from regressing behind a passing dark one.
//
// The assertion is on classes, not on colors, because jsdom never applies
// Tailwind's stylesheet: what is checkable here is the output of the merge.
// The real contrast measurement runs in the browser —
// `front/e2e/header-logout-contrast.spec.ts`.
describe('Header — o botão Sair sobre o chrome (#271)', () => {
  function expectChromeOutline(className: string) {
    expect(className).toContain('bg-transparent')
    expect(className).toContain('text-chrome-foreground')
    expect(className).toContain('border-chrome-foreground/40')
    expect(className).toContain('hover:bg-chrome-foreground/10')
    expect(className).toContain('hover:text-chrome-foreground')
    expect(className).not.toContain('bg-background')
    expect(className).not.toContain('hover:text-accent-foreground')
  }

  it('keeps the desktop button transparent, so the chrome shows through', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    expectChromeOutline((await screen.findByTestId('header-logout-button')).className)
  })

  it('keeps the mobile panel button transparent too', async () => {
    setSession(fakeUser, 'tok-1')
    renderHeader()

    fireEvent.click(await screen.findByTestId('header-mobile-menu-trigger'))

    expectChromeOutline((await screen.findByTestId('header-mobile-logout-button')).className)
  })
})
