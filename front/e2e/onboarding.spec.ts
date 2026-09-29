import { randomUUID } from 'node:crypto'
import { type APIRequestContext, type Browser, expect, type Page, test } from '@playwright/test'

import { BACK_URL } from './support/rounds'

// Visual walkthrough for #213: the first-access invite to the guided tour, the
// tour itself over the real screens, and the "Como funciona" page.
//
// The invite waits out any open round, and the round slot is global — a
// parallel spec holding a round open would hide it at random. So, like
// leaderboard-denominators.spec.ts, this file answers `/rounds` with
// `page.route` and the page's `/sse` fetch with a stream that stays open,
// both local to this file (#386 keeps such helpers out of e2e/support until
// one is extracted on purpose). Authentication, `GET /me` and
// `POST /me/onboarding` stay real: persistence across browsers is the point.
const evidence = (name: string) => `e2e/evidence/213/${name}.png`

const PASSWORD = 'onboarding-213-password'

type SseFrame = Record<string, unknown>
const quietFrames = (): SseFrame[] => [
  {
    type: 'state.sync',
    serverTime: new Date().toISOString(),
    round: null,
    submissionsPaused: false,
  },
]

const openRoundId = randomUUID()
const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
const openRoundFrames = (): SseFrame[] => [
  {
    type: 'state.sync',
    serverTime: new Date().toISOString(),
    round: { id: openRoundId, closesAt: inOneHour() },
    submissionsPaused: false,
  },
]
const openRoundList = () => [
  {
    id: openRoundId,
    name: 'Rodada ao vivo',
    status: 'open',
    durationMinutes: 60,
    openedAt: new Date().toISOString(),
    closesAt: inOneHour(),
    closedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    problemCount: 2,
  },
]

async function stubSse(page: Page, frames: SseFrame[]) {
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

/** No round anywhere (default), or one open round on both channels. */
async function stubRounds(page: Page, scenario: 'none' | 'open' = 'none') {
  await stubSse(page, scenario === 'open' ? openRoundFrames() : quietFrames())
  await page.route(`${BACK_URL}/rounds`, (route) =>
    route.fulfill({ json: scenario === 'open' ? openRoundList() : [] }),
  )
}

async function signUp(request: APIRequestContext) {
  const email = `onboarding-213-${randomUUID()}@edu.pucrs.br`
  const response = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'Ana Tour', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(response.status()).toBe(201)
  return email
}

async function login(request: APIRequestContext, email: string) {
  const response = await request.post(`${BACK_URL}/auth/login`, {
    data: { email, password: PASSWORD },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).token as string
}

async function signIn(page: Page, token: string) {
  await page.addInitScript((token) => localStorage.setItem('kumite-token', token), token)
}

function collectPageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250) // popover/scroll animations settle
  await page.screenshot({ path: evidence(name), fullPage: false })
}

async function expectStep(page: Page, id: string) {
  await expect(page.getByTestId('tour-popover')).toHaveAttribute('data-tour-step', id)
}

/** The whole popover inside the viewport — controls reachable on every step. */
async function expectPopoverOnScreen(page: Page, width: number, height: number) {
  await expect
    .poll(async () => {
      const box = await page.getByTestId('tour-popover').boundingBox()
      if (!box) return 'no box'
      const inside =
        box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height
      return inside ? 'inside' : JSON.stringify(box)
    })
    .toBe('inside')
}

async function newSignedInPage(browser: Browser, token: string, scenario: 'none' | 'open') {
  const context = await browser.newContext({ locale: 'pt-BR' })
  const page = await context.newPage()
  await stubRounds(page, scenario)
  await signIn(page, token)
  return { context, page }
}

test.describe('onboarding tour (#213)', () => {
  test('(a) a new participant is asked once; declining sticks on any browser', async ({
    page,
    request,
    browser,
  }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await stubRounds(page)
    const email = await signUp(request)
    await signIn(page, await login(request, email))

    await page.goto('/')
    await expect(page.getByTestId('onboarding-invite')).toBeVisible()
    // Asking is not starting.
    await expect(page.getByTestId('tour-popover')).toHaveCount(0)
    await capture(page, '01-invite-desktop')

    await page.getByTestId('onboarding-invite-decline').click()
    await expect(page.getByTestId('onboarding-invite')).toHaveCount(0)
    await expect(page.getByTestId('tour-popover')).toHaveCount(0)

    // Recorded on the back…
    const token = await login(request, email)
    await expect
      .poll(async () => {
        const me = await request.get(`${BACK_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        return (await me.json()).onboardingPromptedAt
      })
      .not.toBeNull()

    // …so neither a reload nor another browser asks again.
    await page.reload()
    await expect(page.getByTestId('home-round-card')).toBeVisible()
    await expect(page.getByTestId('onboarding-invite')).toHaveCount(0)

    const other = await newSignedInPage(browser, token, 'none')
    await other.page.goto('/')
    await expect(other.page.getByTestId('home-round-card')).toBeVisible()
    await expect(other.page.getByTestId('onboarding-invite')).toHaveCount(0)
    await capture(other.page, '02-declined-other-browser')
    await other.context.close()

    expect(errors).toEqual([])
  })

  test('(b) accepting walks the six steps over the real screens and finishes home', async ({
    page,
    request,
  }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await stubRounds(page)
    await signIn(page, await login(request, await signUp(request)))

    await page.goto('/')
    await page.getByTestId('onboarding-invite-accept').click()
    await expect(page.getByTestId('onboarding-invite')).toHaveCount(0)

    const steps: Array<[string, string, string]> = [
      ['header', '/', 'language-selector'],
      ['round', '/', 'home-round-card'],
      ['teams', '/teams', 'teams-heading'],
      ['editor', '/practice/', 'editor'],
      ['leaderboard', '/leaderboard', 'leaderboard-tabs'],
      ['practice', '/practice', 'practice-list'],
    ]
    for (const [index, [id, path, target]] of steps.entries()) {
      await expectStep(page, id)
      await expect(page.getByTestId('tour-step-indicator')).toHaveText(`Passo ${index + 1} de 6`)
      expect(new URL(page.url()).pathname.startsWith(path)).toBe(true)
      if (id !== 'leaderboard') {
        await expect(page.getByTestId(target).first()).toHaveAttribute('data-tour-highlight')
      } else {
        await expect(page.locator('[data-tour-highlight]')).toHaveCount(1)
      }
      if (index === 0) await expect(page.getByTestId('tour-prev')).toBeDisabled()
      else await expect(page.getByTestId('tour-prev')).toBeEnabled()
      await expectPopoverOnScreen(page, 1280, 800)
      await capture(page, `03-tour-step-${index + 1}-${id}`)
      if (index < steps.length - 1) await page.getByTestId('tour-next').click()
    }

    await expect(page.getByTestId('tour-next')).toHaveCount(0)
    await page.getByTestId('tour-finish').click()
    await expect(page.getByTestId('tour-popover')).toHaveCount(0)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('[data-tour-highlight]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('(c) the user menu starts it anywhere; exiting on step 3 returns there', async ({
    page,
    request,
  }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await stubRounds(page)
    const token = await login(request, await signUp(request))
    // Already answered: the permanent control is how they come back to it.
    const marked = await request.post(`${BACK_URL}/me/onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(marked.status()).toBe(200)
    await signIn(page, token)

    await page.goto('/leaderboard')
    await expect(page.getByTestId('leaderboard-tabs')).toBeVisible()
    const origin = page.url()
    await page.getByTestId('header-user-menu-trigger').click()
    await capture(page, '04-user-menu-controls')
    await page.getByTestId('header-start-tour').click()

    await expectStep(page, 'header')
    await page.getByTestId('tour-next').click()
    await expectStep(page, 'round')
    await page.getByTestId('tour-next').click()
    await expectStep(page, 'teams')
    await expect(page).toHaveURL(/\/teams$/)

    await page.getByTestId('tour-exit').click()
    await expect(page.getByTestId('tour-popover')).toHaveCount(0)
    await expect(page).toHaveURL(origin)
    await expect(page.getByTestId('leaderboard-tabs')).toBeVisible()
    await capture(page, '05-exit-back-to-leaderboard')
    expect(errors).toEqual([])
  })

  test('(d) with a round open the invite waits; with none it shows', async ({
    browser,
    request,
  }) => {
    const token = await login(request, await signUp(request))

    const live = await newSignedInPage(browser, token, 'open')
    await live.page.setViewportSize({ width: 1280, height: 800 })
    await live.page.goto('/')
    await expect(live.page.getByTestId('home-round-live')).toBeVisible()
    await expect(live.page.getByTestId('onboarding-invite')).toHaveCount(0)
    await capture(live.page, '06-round-open-no-invite')
    await live.context.close()

    const quiet = await newSignedInPage(browser, token, 'none')
    await quiet.page.setViewportSize({ width: 1280, height: 800 })
    await quiet.page.goto('/')
    await expect(quiet.page.getByTestId('onboarding-invite')).toBeVisible()
    await quiet.context.close()
  })

  test('(e) a failed save hides the card, explains, and never blocks navigation', async ({
    page,
    request,
  }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await stubRounds(page)
    await page.route(`${BACK_URL}/me/onboarding`, (route) =>
      route.fulfill({ status: 500, json: { error: 'internal_error', message: 'boom' } }),
    )
    await signIn(page, await login(request, await signUp(request)))

    await page.goto('/')
    await page.getByTestId('onboarding-invite-decline').click()
    await expect(page.getByTestId('onboarding-invite')).toHaveCount(0)
    await expect(page.getByTestId('onboarding-invite-save-error')).toBeVisible()
    await capture(page, '07-save-failed-note')

    await page.getByTestId('header-teams-link').first().click()
    await expect(page).toHaveURL(/\/teams$/)
    await expect(page.getByTestId('teams-heading')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('(f) "Como funciona" is public, in pt, es and en, from the footer and the header', async ({
    page,
  }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto('/login')
    await page.getByTestId('footer-how-it-works-link').click()
    await expect(page).toHaveURL(/\/how-it-works$/)
    await expect(page.getByTestId('how-it-works-screen').locator('h1')).toHaveText('Como funciona')
    await expect(page.getByTestId('how-it-works-section-rounds')).toContainText(
      'Rodadas e pontuação',
    )
    await capture(page, '08-how-it-works-pt')

    await page.getByTestId('language-option-es').click()
    await expect(page.getByTestId('how-it-works-screen').locator('h1')).toHaveText('Cómo funciona')
    await capture(page, '09-how-it-works-es')

    await page.goto('/login')
    await page.getByTestId('header-how-it-works-link').click()
    await expect(page).toHaveURL(/\/how-it-works$/)
    await page.getByTestId('language-option-en').click()
    await expect(page.getByTestId('how-it-works-screen').locator('h1')).toHaveText('How it works')
    await expect(page.getByTestId('how-it-works-section-practice')).toContainText(
      'Where to practice',
    )
    await capture(page, '10-how-it-works-en')
    expect(errors).toEqual([])
  })

  test('(g) at 375px the invite and the tour fit the phone', async ({ page, request }) => {
    const errors = collectPageErrors(page)
    await page.setViewportSize({ width: 375, height: 740 })
    await stubRounds(page)
    await signIn(page, await login(request, await signUp(request)))

    await page.goto('/')
    await expect(page.getByTestId('onboarding-invite')).toBeVisible()
    await capture(page, '11-invite-375')

    await page.getByTestId('onboarding-invite-accept').click()
    for (const id of ['header', 'round', 'teams', 'editor', 'leaderboard', 'practice']) {
      await expectStep(page, id)
      await expectPopoverOnScreen(page, 375, 740)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      if (id === 'teams' || id === 'editor') await capture(page, `12-tour-step-375-${id}`)
      if (id !== 'practice') await page.getByTestId('tour-next').click()
    }
    await page.getByTestId('tour-finish').click()
    await expect(page.getByTestId('tour-popover')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
