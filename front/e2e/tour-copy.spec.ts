import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type APIRequestContext, type Browser, expect, type Page, test } from '@playwright/test'

import {
  BLOCKLY_INJECTION_TIMEOUT_MS,
  EDITOR_TEST_TIMEOUT_MS,
  expectBlocklyInjected,
} from './support/blockly'
import { seedParticipant, seedParticipantToken } from './support/editor-fixture'
import { BACK_URL } from './support/rounds'

// Visual walkthrough for #393: the rules the tour, "Como funciona" and the
// soma-lista demo now state, on the screens a participant reads them on.
// Every assertion compares what renders with the catalog value itself, so each
// screenshot is the exact text that ships — the reading D4 asks of a native
// es speaker. The labels those texts quote are the unit test's job
// (src/i18n/copy-consistency.test.ts); this file proves the texts reach the
// screen whole and still fit it.
//
// Same isolation as onboarding.spec.ts (#213): `/rounds` and the page's `/sse`
// are answered locally, so no round another spec holds open hides the invite.
// Kept local to this file on purpose (#386), like there.
const evidence = (name: string) => `e2e/evidence/393/${name}.png`

type Locale = 'pt' | 'es' | 'en'
type Catalog = Record<string, unknown>
const catalogs: Record<Locale, Catalog> = {
  pt: JSON.parse(readFileSync(new URL('../src/i18n/pt.json', import.meta.url), 'utf8')),
  es: JSON.parse(readFileSync(new URL('../src/i18n/es.json', import.meta.url), 'utf8')),
  en: JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8')),
}

function copy(locale: Locale, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object' ? (node as Catalog)[part] : undefined,
      catalogs[locale],
    )
  if (typeof value !== 'string') throw new Error(`${locale}: ${key} is not a string`)
  return value
}

const TOUR = ['header', 'round', 'teams', 'editor', 'leaderboard', 'practice'] as const
const SECTIONS = ['what', 'teams', 'rounds', 'editor', 'practice'] as const
const PASSWORD = 'tour-copy-393-password'

async function stubQuietRounds(page: Page) {
  const frame = {
    type: 'state.sync',
    serverTime: new Date().toISOString(),
    round: null,
    submissionsPaused: false,
  }
  await page.addInitScript((frame) => {
    const realFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (new URL(url, window.location.href).pathname !== '/sse') return realFetch(input, init)
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`))
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason))
        },
      })
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      )
    }
  }, frame)
  await page.route(`${BACK_URL}/rounds`, (route) => route.fulfill({ json: [] }))
}

async function newParticipantToken(request: APIRequestContext): Promise<string> {
  const email = `tour-copy-393-${randomUUID()}@edu.pucrs.br`
  const signup = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'Bea Texto', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(signup.status()).toBe(201)
  const login = await request.post(`${BACK_URL}/auth/login`, {
    data: { email, password: PASSWORD },
  })
  expect(login.ok()).toBeTruthy()
  return (await login.json()).token as string
}

/** A first-access participant on the home page, browser language `locale`. */
async function freshParticipantHome(
  browser: Browser,
  request: APIRequestContext,
  browserLocale: string,
  viewport: { width: number; height: number },
) {
  const context = await browser.newContext({ locale: browserLocale, viewport })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await stubQuietRounds(page)
  const token = await newParticipantToken(request)
  await page.addInitScript((token) => localStorage.setItem('kumite-token', token), token)
  await page.goto('/')
  return { context, page, errors }
}

async function capture(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250) // popover/scroll animations settle
  await page.screenshot({ path: evidence(name), fullPage })
}

async function expectStepCopy(page: Page, locale: Locale, id: (typeof TOUR)[number]) {
  // The editor step lands once the problem screen renders its editor: the
  // Blockly injection's own budget (#246), not the 30 s expect ceiling.
  const timeout = id === 'editor' ? BLOCKLY_INJECTION_TIMEOUT_MS : undefined
  await expect(page.getByTestId('tour-popover')).toHaveAttribute('data-tour-step', id, { timeout })
  await expect(page.getByTestId('tour-step-title')).toHaveText(
    copy(locale, `onboarding.tour.steps.${id}.title`),
  )
  await expect(page.getByTestId('tour-step-body')).toHaveText(
    copy(locale, `onboarding.tour.steps.${id}.body`),
  )
}

/** The whole popover on screen and no horizontal scroll: the longer texts fit. */
async function expectFits(page: Page, width: number, height: number) {
  await expect
    .poll(async () => {
      const box = await page.getByTestId('tour-popover').boundingBox()
      if (!box) return 'no box'
      const inside =
        box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height
      return inside ? 'inside' : JSON.stringify(box)
    })
    .toBe('inside')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('the rules as the participant reads them (#393)', () => {
  // (b)–(d) walk the tour through its editor step and (e) opens the demo:
  // each injects Blockly once, which has its own budget (#246).
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })

  test('(a) "Como funciona" states the real rules in pt, es and en', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/how-it-works')

    const shots: Array<[Locale, string]> = [
      ['pt', '01-how-it-works-pt'],
      ['es', '02-how-it-works-es'],
      ['en', '03-how-it-works-en'],
    ]
    for (const [locale, shot] of shots) {
      await page.getByTestId(`language-option-${locale}`).click()
      await expect(page.getByTestId('how-it-works-screen').locator('h1')).toHaveText(
        copy(locale, 'howItWorks.title'),
      )
      for (const id of SECTIONS) {
        const section = page.getByTestId(`how-it-works-section-${id}`)
        await expect(section).toContainText(copy(locale, `howItWorks.sections.${id}.title`))
        await expect(section).toContainText(copy(locale, `howItWorks.sections.${id}.body`))
      }
      await capture(page, shot, true)
    }
    expect(errors).toEqual([])
  })

  test('(b) pt: the invite and the six tour steps', async ({ browser, request }) => {
    const { context, page, errors } = await freshParticipantHome(browser, request, 'pt-BR', {
      width: 1280,
      height: 800,
    })
    await expect(page.getByTestId('onboarding-invite')).toContainText(
      copy('pt', 'onboarding.invite.body'),
    )
    await capture(page, '04-invite-pt')

    await page.getByTestId('onboarding-invite-accept').click()
    for (const [index, id] of TOUR.entries()) {
      await expectStepCopy(page, 'pt', id)
      if (id === 'leaderboard') {
        // The tabs the step names are the tabs on screen.
        await expect(page.getByTestId('leaderboard-tab-round')).toHaveText(
          copy('pt', 'leaderboard.tabs.round'),
        )
        await expect(page.getByTestId('leaderboard-tab-event')).toHaveText(
          copy('pt', 'leaderboard.tabs.event'),
        )
      }
      await expectFits(page, 1280, 800)
      await capture(page, `05-tour-pt-${index + 1}-${id}`)
      if (index < TOUR.length - 1) await page.getByTestId('tour-next').click()
    }
    await page.getByTestId('tour-finish').click()
    await expect(page.getByTestId('tour-popover')).toHaveCount(0)
    expect(errors).toEqual([])
    await context.close()
  })

  test('(c) es: the invite and the header, leaderboard and practice steps say Marcador', async ({
    browser,
    request,
  }) => {
    const { context, page, errors } = await freshParticipantHome(browser, request, 'es-MX', {
      width: 1280,
      height: 800,
    })
    await expect(page.getByTestId('language-option-es')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId('onboarding-invite')).toContainText(
      copy('es', 'onboarding.invite.body'),
    )
    await capture(page, '06-invite-es')

    await page.getByTestId('onboarding-invite-accept').click()
    for (const [index, id] of TOUR.entries()) {
      await expectStepCopy(page, 'es', id)
      if (id === 'header') {
        // The header step lists the header's own links.
        await expect(page.getByTestId('header-leaderboard-link').first()).toHaveText(
          copy('es', 'header.leaderboardLink'),
        )
      }
      if (id === 'leaderboard') {
        await expect(page.getByTestId('leaderboard-tab-round')).toHaveText(
          copy('es', 'leaderboard.tabs.round'),
        )
        await expect(page.getByTestId('leaderboard-tab-event')).toHaveText(
          copy('es', 'leaderboard.tabs.event'),
        )
      }
      await expectFits(page, 1280, 800)
      if (id === 'header' || id === 'leaderboard' || id === 'practice') {
        await capture(page, `07-tour-es-${index + 1}-${id}`)
      }
      if (index < TOUR.length - 1) await page.getByTestId('tour-next').click()
    }
    expect(errors).toEqual([])
    await context.close()
  })

  test('(d) at 375px the longer teams and practice steps still fit', async ({
    browser,
    request,
  }) => {
    const { context, page, errors } = await freshParticipantHome(browser, request, 'pt-BR', {
      width: 375,
      height: 740,
    })
    await page.getByTestId('onboarding-invite-accept').click()
    for (const [index, id] of TOUR.entries()) {
      await expectStepCopy(page, 'pt', id)
      await expectFits(page, 375, 740)
      if (id === 'teams' || id === 'practice') await capture(page, `08-tour-375-${id}`)
      if (index < TOUR.length - 1) await page.getByTestId('tour-next').click()
    }
    expect(errors).toEqual([])
    await context.close()
  })

  test('(e) soma-lista step 4 explains the "numero" variable in pt and en', async ({ page }) => {
    const aluno = await seedParticipant('Demo Texto', 'Texto Demo')
    const res = await fetch(`${BACK_URL}/practice/problems?locale=pt`, {
      headers: { Authorization: `Bearer ${aluno.token}` },
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as { id: string; title: string }[]
    const somaLista = list.find((problem) => problem.title === 'Soma da lista')
    if (!somaLista) throw new Error('no "Soma da lista" — run `pnpm worktree:env --reset` first')

    await page.setViewportSize({ width: 1280, height: 800 })
    await seedParticipantToken(page, aluno.token)
    await page.goto(`/practice/${somaLista.id}`)
    await expectBlocklyInjected(page)
    await page.getByTestId('practice-demo-start').click()
    for (let i = 0; i < 3; i++) await page.getByTestId('practice-demo-next').click()
    await expect(page.getByTestId('practice-demo-position')).toHaveText('Passo 4 de 8')
    await expect(
      page.getByTestId('practice-demo-canvas').locator('[data-id="paraCada"]'),
    ).toBeVisible()
    await expect(page.getByTestId('practice-demo-step-text')).toHaveText(
      copy('pt', 'practice.demo.steps.soma-lista.4'),
    )
    await capture(page, '09-demo-soma-lista-4-pt')

    await page.getByTestId('language-option-en').click()
    await expect(page.getByTestId('practice-demo-position')).toHaveText('Step 4 of 8')
    await expect(page.getByTestId('practice-demo-step-text')).toHaveText(
      copy('en', 'practice.demo.steps.soma-lista.4'),
    )
    await capture(page, '10-demo-soma-lista-4-en')
  })
})
