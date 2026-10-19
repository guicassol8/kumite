import type { APIRequestContext, Locator, Page } from '@playwright/test'
import type { InferResponseType } from 'hono'
import type { api } from '../src/lib/api'
import {
  BACK_URL,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// #467: "Hairlines de 1 px, sem sombra além do anel de foco"
// (`docs/design/identity.md` § 5). The `Card` used to carry shadcn's
// `shadow-sm` and the `SheetContent` its `shadow-lg`; six screens cancelled
// the card's case by case with `shadow-none`. Both primitives now cast no
// shadow, so every card and the mobile menu compute `box-shadow: none` in both
// themes, and keep the 1 px hairline that separates them from the page. jsdom
// never applies Tailwind, so the computed shadow can only be settled here.
//
// The anonymous surfaces always run. The participant ones sign up through the
// API and serve `/rounds` and `/sse` with no round (as in onboarding.spec.ts,
// local to this file per #386), so the onboarding invite draws regardless of a
// round a parallel spec holds open. The organizer ones skip without the seeded
// organizer, like the rest of the suite.
const evidence = (name: string) => `e2e/evidence/467/${name}.png`

type TeamsResponse = InferResponseType<typeof api.teams.$get, 200>

const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

const PASSWORD = 'supersecret'

async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem('kumite:theme', value), theme)
}

async function capture(page: Page, name: string | undefined) {
  if (!name) return
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: evidence(name), fullPage: true })
}

/** Acceptance 1: no shadow, and the hairline is still there. */
async function expectFlatCard(card: Locator) {
  await expect(card).toBeVisible()
  await expect(card).toHaveCSS('box-shadow', 'none')
  await expect(card).toHaveCSS('border-top-width', '1px')
}

/** The mobile menu opens from the right, so its hairline is the left border. */
async function expectFlatMobileMenu(page: Page) {
  await page.getByTestId('header-mobile-menu-trigger').click()
  const menu = page.getByTestId('header-mobile-menu')
  await expect(menu).toBeVisible()
  // The slide-in has to finish before the capture; the shadow is none throughout.
  await menu.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
  await expect(menu).toHaveCSS('box-shadow', 'none')
  await expect(menu).toHaveCSS('border-left-width', '1px')
}

async function apiToken(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${BACK_URL}/auth/login`, { data: { email, password } })
  expect(response.ok()).toBeTruthy()
  const { token } = (await response.json()) as { token: string }
  return token
}

async function signInAs(page: Page, token: string) {
  await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)
}

async function participant(request: APIRequestContext) {
  const email = `surface-${Date.now()}-${Math.random().toString(36).slice(2)}@edu.pucrs.br`
  const signup = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'E2E Participante', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(signup.ok()).toBeTruthy()
  return { email, token: await apiToken(request, email, PASSWORD) }
}

/** An SSE stream that syncs "no round" once and then stays open. */
async function stubSse(page: Page) {
  const frames = [
    {
      type: 'state.sync',
      serverTime: new Date().toISOString(),
      round: null,
      submissionsPaused: false,
    },
  ]
  await page.addInitScript((frames) => {
    const realFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (new URL(url, window.location.href).pathname !== '/sse') return realFetch(input, init)
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const frame of frames) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`))
          }
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason))
        },
      })
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      )
    }
  }, frames)
}

/** No round on either channel: the onboarding invite waits out an open one. */
async function stubRounds(page: Page) {
  await stubSse(page)
  await page.route(`${BACK_URL}/rounds`, (route) => route.fulfill({ json: [] }))
}

/** The participant's own team, so `/teams` draws `my-team-panel`. */
function teamsFixture(email: string): TeamsResponse {
  return {
    maxTeamSize: 4,
    mixingLocked: false,
    myTeamId: 'mine',
    teams: [
      {
        id: 'mine',
        name: 'Byte Fighters',
        members: [{ university: 'pucrs', name: 'E2E Participante', email }],
        slotsAvailable: 3,
        frozen: false,
        joinBlockedReason: 'already_in_team',
      },
    ],
  }
}

for (const theme of THEMES) {
  const light = theme === 'light'

  test.describe(`${theme}: cards and the mobile menu cast no shadow (#467)`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme)
    })

    test.describe('anonymous', () => {
      test('404: a card that never cancelled the primitive shadow', async ({ page }) => {
        await page.setViewportSize(DESKTOP)
        await page.goto('/rota-que-nao-existe')
        await expectFlatCard(page.getByTestId('not-found-card'))
        await capture(page, light ? '01-404-claro' : '02-404-escuro')
      })

      test('mobile menu', async ({ page }) => {
        await page.setViewportSize(PHONE)
        await page.goto('/login')
        await expectFlatMobileMenu(page)
        await capture(page, light ? '03-menu-celular-claro' : '04-menu-celular-escuro')
      })
    })

    test.describe('participant', () => {
      test('home: the onboarding invite and the three cards', async ({ page, request }) => {
        const { token } = await participant(request)
        await stubRounds(page)
        await signInAs(page, token)
        await page.setViewportSize(DESKTOP)
        await page.goto('/')
        for (const testId of [
          'onboarding-invite',
          'home-round-card',
          'home-team-card',
          'home-closed-rounds',
        ]) {
          await expectFlatCard(page.getByTestId(testId))
        }
        await capture(page, light ? '05-inicio-claro' : '06-inicio-escuro')
      })

      test('teams: my-team-panel', async ({ page, request }) => {
        const { email, token } = await participant(request)
        await stubRounds(page)
        await signInAs(page, token)
        await page.route(`${BACK_URL}/teams`, (route) =>
          route.request().method() === 'GET'
            ? route.fulfill({ json: teamsFixture(email) })
            : route.continue(),
        )
        await page.setViewportSize(DESKTOP)
        await page.goto('/teams')
        await expectFlatCard(page.getByTestId('my-team-panel'))
        await capture(page, light ? undefined : '07-times-escuro')
      })

      test('mobile menu with the user block', async ({ page, request }) => {
        const { token } = await participant(request)
        await stubRounds(page)
        await signInAs(page, token)
        await page.setViewportSize(PHONE)
        await page.goto('/')
        await expectFlatMobileMenu(page)
      })
    })

    test.describe('organizer', () => {
      test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

      test.beforeEach(async ({ page, request }) => {
        await signInAs(page, await apiToken(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD))
        await page.setViewportSize(DESKTOP)
      })

      test('home: the organizer shortcuts', async ({ page }) => {
        await page.goto('/')
        await expectFlatCard(page.getByTestId('home-organizer-shortcuts'))
      })

      test('overview: the stat and shortcut cards', async ({ page }) => {
        await page.goto('/organizer')
        for (const testId of [
          'overview-signups-card',
          'overview-teams-card',
          'overview-submissions-card',
          'overview-round-card',
          'overview-shortcuts-card',
        ]) {
          await expectFlatCard(page.getByTestId(testId))
        }
        await capture(page, light ? '08-organizador-claro' : undefined)
      })
    })
  })
}
