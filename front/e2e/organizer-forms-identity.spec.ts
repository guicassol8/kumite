import type { APIRequestContext, Locator, Page } from '@playwright/test'

import {
  BACK_URL,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// #233 — the organizer panel's WRITE surfaces in the identity: the problem,
// round and event-rule forms, and all ten panel overlays. jsdom does no
// layout, so control height, computed colour and horizontal overflow can only
// be settled here, in a real browser.
//
// Authentication is real (the seeded organizer). The panel's READS are served
// from `page.route`, exactly as #223's spec does it: this spec asserts how the
// write surfaces are *painted*, and producing the underlying states for real
// would mean contending on the event-wide single-open-round slot for no gain.
const evidence = (name: string) => `e2e/evidence/233/${name}.png`

const PHONE = { width: 390, height: 844 }
/** Exactly the breakpoint — the tightest width the panel ever gets a table at. */
const BREAKPOINT = { width: 768, height: 1024 }
const DESKTOP = { width: 1280, height: 900 }

const LANGUAGES = ['pt', 'es', 'en'] as const

const problems = [
  {
    id: 'p-easy',
    points: 10,
    difficulty: 'easy',
    status: 'published',
    testCaseCount: 3,
    translations: [
      { locale: 'pt', title: 'Soma de dois números' },
      { locale: 'es', title: 'Suma de dos números' },
      { locale: 'en', title: 'Sum of two numbers' },
    ],
  },
  {
    id: 'p-draft',
    points: 20,
    difficulty: 'hard',
    status: 'draft',
    testCaseCount: 2,
    translations: [{ locale: 'pt', title: 'Caminho mais curto' }],
  },
]

const rounds = [
  {
    id: 'r-draft',
    name: 'Rodada 3',
    status: 'draft',
    durationMinutes: 30,
    openedAt: null,
    closesAt: null,
    closedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    problemCount: 2,
  },
  {
    id: 'r-open',
    name: 'Rodada 2',
    status: 'open',
    durationMinutes: 45,
    openedAt: '2026-09-02T12:00:00.000Z',
    closesAt: new Date(Date.now() + 40 * 60_000).toISOString(),
    closedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    problemCount: 3,
  },
]

const users = {
  items: [
    {
      id: 'u-1',
      email: 'ada.lovelace@edu.pucrs.br',
      name: 'Ada Lovelace',
      role: 'participant',
      university: 'pucrs',
      active: true,
      team: { id: 't-1', name: 'Blockly Busters' },
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  total: 1,
}

const organizerTeams = {
  maxTeamSize: 4,
  teams: [
    {
      id: 't-1',
      name: 'Blockly Busters',
      frozen: false,
      slotsAvailable: 2,
      members: [
        {
          userId: 'u-1',
          email: 'ada.lovelace@edu.pucrs.br',
          name: 'Ada Lovelace',
          university: 'pucrs',
          role: 'participant',
        },
      ],
    },
  ],
}

const eventCodes = [
  {
    code: 'PUCRS2026',
    university: 'pucrs',
    allowedEmailSuffixes: ['edu.pucrs.br'],
    active: true,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
]

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: evidence(name), fullPage: true })
}

/** Identity § 5: horizontal scroll is never the answer to overflow. */
async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
}

/** The same criterion, panel-scoped, naming the element that crossed the edge. */
async function noPanelOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return null
    const width = window.innerWidth
    return {
      scrolls: main.scrollWidth > main.clientWidth,
      offenders: Array.from(main.querySelectorAll('*'))
        .filter((node) => node.getBoundingClientRect().right > width + 0.5)
        .map((node) => (node as HTMLElement).dataset.testid ?? node.tagName)
        .slice(0, 6),
    }
  })
  expect(report).not.toBeNull()
  expect(report?.offenders).toEqual([])
  expect(report?.scrolls).toBe(false)
}

/**
 * The literal `rgb(...)` a design token resolves to in the current theme.
 *
 * Resolved by the browser through a throwaway probe rather than parsed from
 * the declaration: the token's own value may be a hex, an `oklch()` or another
 * `var()`, and only the engine knows what `toHaveCSS` will compare against.
 * Requires a loaded document — on `about:blank` there is no stylesheet.
 */
async function tokenRgb(page: Page, token: string) {
  return page.evaluate((name) => {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    probe.style.color = `var(${name})`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  }, token)
}

async function tokenColor(page: Page, element: Locator, property: string, token: string) {
  await expect(element).toHaveCSS(property, await tokenRgb(page, token))
}

async function login(request: APIRequestContext) {
  const response = await request.post(`${BACK_URL}/auth/login`, {
    data: { email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD },
  })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  return token as string
}

/**
 * The rounds list, with or without an open round.
 *
 * It has to be switchable per test: the event allows a single open round, so
 * the row's "Abrir" button is disabled while one is open, and the "Encerrar"
 * and "Estender" buttons only exist while one is. No single fixture reaches
 * all three dialogs.
 */
async function setRounds(page: Page, withOpenRound: boolean) {
  const body = withOpenRound ? rounds : [rounds[0]]
  await page.unroute(`${BACK_URL}/organizer/rounds`)
  await page.route(`${BACK_URL}/organizer/rounds`, (route) => route.fulfill({ json: body }))
}

type PanelOptions = {
  theme?: 'light' | 'dark'
  mixingLocked?: boolean
  /** Default true — the list carries `r-open`. */
  openRound?: boolean
}

async function installPanel(page: Page, request: APIRequestContext, options: PanelOptions = {}) {
  const token = await login(request)
  await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)
  if (options.theme === 'dark') {
    await page.addInitScript(() => localStorage.setItem('kumite:theme', 'dark'))
  }

  await page.route(`${BACK_URL}/organizer/problems`, (route) => route.fulfill({ json: problems }))
  const roundsBody = options.openRound === false ? [rounds[0]] : rounds
  await page.route(`${BACK_URL}/organizer/rounds`, (route) => route.fulfill({ json: roundsBody }))
  await page.route(`${BACK_URL}/organizer/teams`, (route) =>
    route.fulfill({ json: organizerTeams }),
  )
  await page.route(`${BACK_URL}/organizer/users*`, (route) => route.fulfill({ json: users }))
  await page.route(`${BACK_URL}/organizer/event-codes`, (route) =>
    route.fulfill({ json: eventCodes }),
  )
  await page.route(`${BACK_URL}/organizer/event-config`, (route) =>
    route.fulfill({
      json: { mixingLocked: options.mixingLocked ?? false, maxTeamSize: 4, updatedAt: null },
    }),
  )
}

async function switchLanguage(page: Page, language: (typeof LANGUAGES)[number]) {
  await page.getByTestId(`language-option-${language}`).click()
  await expect(page.getByTestId(`language-option-${language}`)).toHaveAttribute(
    'aria-current',
    'true',
  )
}

/** Every visible single-line control inside a container measures 36 px tall. */
async function controlsAre36px(page: Page, container: string) {
  const heights = await page.evaluate((selector) => {
    const root = document.querySelector(selector)
    if (!root) return null
    return Array.from(root.querySelectorAll('input'))
      .filter((node) => node.type !== 'checkbox' && node.offsetParent !== null)
      .map((node) => Math.round(node.getBoundingClientRect().height))
  }, container)
  expect(heights).not.toBeNull()
  expect(heights?.length).toBeGreaterThan(0)
  for (const height of heights ?? []) expect(height).toBe(36)
}

test.describe('organizer panel forms and dialogs in the identity (#233)', () => {
  test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

  test('problem form: 36 px controls, 13/500 labels, Publicar the only brand button', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form')).toBeVisible()

    // Criterion 1 — every single-line control is 36 px, at every width. The
    // multiline statement Textarea is out of the rule by construction.
    await controlsAre36px(page, '[data-testid="problem-form"]')

    // Criterion 2 — labels at 13/500.
    for (const testId of ['problem-form-points', 'problem-form-title-pt']) {
      const id = await page.getByTestId(testId).getAttribute('id')
      const label = page.locator(`label[for="${id}"]`)
      await expect(label).toHaveCSS('font-size', '13px')
      await expect(label).toHaveCSS('font-weight', '500')
    }

    // Criterion 4 — one brand-filled button on the screen, and it is Publicar.
    const publish = page.getByTestId('problem-form-publish')
    await tokenColor(page, publish, 'background-color', '--brand')
    const brand = await tokenRgb(page, '--brand')
    const branded = await page.evaluate((expected) => {
      const main = document.querySelector('main')
      return Array.from(main?.querySelectorAll('button') ?? [])
        .filter((node) => getComputedStyle(node).backgroundColor === expected)
        .map((node) => node.dataset.testid ?? node.tagName)
    }, brand)
    expect(branded).toEqual(['problem-form-publish'])

    // The statement and the case values are Mono, at 13 px — asserted at a
    // desktop width on purpose: `ui/input.tsx` and `ui/textarea.tsx` carry
    // `md:text-sm`, and tailwind-merge does not drop a `md:` utility for an
    // unprefixed one, so only `PANEL_MONO`'s own `md:text-[13px]` keeps these
    // at 13 px from the breakpoint up. Below `md` they would pass either way.
    const statement = page.getByTestId('problem-form-statement-pt')
    await expect(statement).toHaveCSS('font-size', '13px')
    expect(
      (await statement.evaluate((node) => getComputedStyle(node).fontFamily)).toLowerCase(),
    ).toContain('mono')

    await page.getByTestId('problem-form-add-case').click()
    for (const field of ['input', 'expected'] as const) {
      const cell = page.getByTestId(`problem-form-case-0-${field}`)
      await expect(cell).toHaveCSS('font-size', '13px')
      expect(
        (await cell.evaluate((node) => getComputedStyle(node).fontFamily)).toLowerCase(),
      ).toContain('mono')
    }

    await capture(page, '01-problema-formulario-desktop')

    await page.setViewportSize(PHONE)
    // Still 36 px on a phone: the § 5 44 px exception is for auth and
    // participant screens, not the panel (plan decision 10).
    await controlsAre36px(page, '[data-testid="problem-form"]')
    await capture(page, '02-problema-formulario-celular')
  })

  test('problem form: a rejected field gets a crimson outline and 13 px crimson text', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form')).toBeVisible()

    const points = page.getByTestId('problem-form-points')
    const restingFill = await points.evaluate((node) => getComputedStyle(node).backgroundColor)

    await points.fill('0')
    await page.getByTestId('problem-form-save').click()

    const message = page.getByTestId('problem-form-points-error')
    await expect(message).toBeVisible()
    await expect(message).toHaveCSS('font-size', '13px')
    await tokenColor(page, message, 'color', '--destructive')

    // Criterion 3 — the outline is the whole signal: the fill never turns red.
    await expect(points).toHaveAttribute('aria-invalid', 'true')
    await tokenColor(page, points, 'border-top-color', '--destructive')
    await expect(points).toHaveCSS('background-color', restingFill)

    await capture(page, '03-problema-erros-por-campo')
  })

  test('round form: 36 px controls, 13/500 labels, and no brand button at all', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/rounds/new')
    await expect(page.getByTestId('round-form')).toBeVisible()

    await controlsAre36px(page, '[data-testid="round-form"]')

    for (const testId of ['round-form-name', 'round-form-duration']) {
      const id = await page.getByTestId(testId).getAttribute('id')
      const label = page.locator(`label[for="${id}"]`)
      await expect(label).toHaveCSS('font-size', '13px')
      await expect(label).toHaveCSS('font-weight', '500')
    }

    // "Abrir rodada" does not live on this screen, so nothing here is brand.
    const brand = await tokenRgb(page, '--brand')
    const branded = await page.evaluate((expected) => {
      const main = document.querySelector('main')
      return Array.from(main?.querySelectorAll('button') ?? [])
        .filter((node) => getComputedStyle(node).backgroundColor === expected)
        .map((node) => node.dataset.testid ?? node.tagName)
    }, brand)
    expect(branded).toEqual([])

    await page.getByTestId('round-form-name').fill('')
    await page.getByTestId('round-form-save').click()
    const message = page.getByTestId('round-form-name-error')
    await expect(message).toBeVisible()
    await expect(message).toHaveCSS('font-size', '13px')
    await tokenColor(page, message, 'color', '--destructive')

    await capture(page, '04-rodada-formulario')
  })

  test('the six destructive confirmations show a crimson outline, never a red fill', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/problems')
    await expect(page.getByTestId('organizer-problems-table')).toBeVisible()
    // Read after the first navigation: on `about:blank` no stylesheet exists.
    const destructive = await tokenRgb(page, '--destructive')

    async function expectCrimsonOutline(testId: string) {
      const action = page.getByTestId(testId)
      await expect(action).toBeVisible()
      // Criterion 5 — transparent surface, crimson border and text.
      await expect(action).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(action).toHaveCSS('border-top-color', destructive)
      await expect(action).toHaveCSS('color', destructive)
    }

    await page.getByTestId('organizer-problems-archive-p-easy').click()
    await expectCrimsonOutline('organizer-problems-archive-confirm')
    await capture(page, '05-dialogo-arquivar')
    await page.keyboard.press('Escape')

    await page.goto('/organizer/rounds')
    await page.getByTestId('organizer-rounds-close-r-open').click()
    await expectCrimsonOutline('organizer-rounds-close-confirm')
    await capture(page, '06-dialogo-encerrar-rodada')
    await page.keyboard.press('Escape')

    await page.goto('/organizer/teams')
    await page.getByTestId('team-moderation-remove-team-action-t-1').click()
    await expectCrimsonOutline('team-moderation-remove-team-confirm-confirm-t-1')
    await capture(page, '09-dialogo-remover-time')
    await page.keyboard.press('Escape')

    await page.getByTestId('team-moderation-remove-member-action-u-1').click()
    await expectCrimsonOutline('team-moderation-remove-member-confirm-confirm-u-1')
    await capture(page, '10-dialogo-remover-integrante')
    await page.keyboard.press('Escape')

    await page.goto('/organizer/users')
    await page.getByTestId('organizer-users-deactivate-u-1').click()
    await expectCrimsonOutline('organizer-users-confirm-confirm-u-1')
    await page.keyboard.press('Escape')

    await page.goto('/organizer/event-config')
    await page.getByTestId('event-config-mixing-switch').click()
    await expectCrimsonOutline('event-config-mixing-confirm-confirm')
    await capture(page, '13-dialogo-mistura-universidades')
  })

  test('"Abrir rodada" is the rounds screen\'s only brand button, and only in its dialog', async ({
    page,
    request,
  }) => {
    // No round open: the single-open-round slot is what disables "Abrir".
    await installPanel(page, request, { openRound: false })
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/rounds')
    await expect(page.getByTestId('organizer-rounds-table')).toBeVisible()

    const brand = await tokenRgb(page, '--brand')
    const brandedButtons = () =>
      page.evaluate((expected) => {
        return Array.from(document.querySelectorAll('button'))
          .filter((node) => getComputedStyle(node).backgroundColor === expected)
          .map((node) => node.dataset.testid ?? node.tagName)
      }, brand)

    // Nothing in the table is brand-filled.
    expect(await brandedButtons()).toEqual([])

    await page.getByTestId('organizer-rounds-open-r-draft').click()
    const confirm = page.getByTestId('organizer-rounds-open-confirm')
    await expect(confirm).toBeVisible()
    await tokenColor(page, confirm, 'background-color', '--brand')
    expect(await brandedButtons()).toEqual(['organizer-rounds-open-confirm'])

    await capture(page, '07-dialogo-abrir-rodada')
  })

  test('the write dialogs: extend, reset password and event codes', async ({ page, request }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)

    await page.goto('/organizer/rounds')
    await page.getByTestId('organizer-rounds-extend-r-open').click()
    const extendDialog = page.getByTestId('organizer-rounds-extend-dialog')
    await expect(extendDialog).toBeVisible()
    // Criterion 7 — § 5: hairlines, no shadow beyond the focus ring.
    await expect(extendDialog).toHaveCSS('box-shadow', 'none')
    const minutes = page.getByTestId('organizer-rounds-extend-minutes')
    expect(Math.round((await minutes.boundingBox())?.height ?? 0)).toBe(36)

    await minutes.fill('0')
    await page.getByTestId('organizer-rounds-extend-confirm').click()
    const extendError = page.getByTestId('organizer-rounds-extend-error')
    await expect(extendError).toBeVisible()
    await expect(extendError).toHaveCSS('font-size', '13px')
    await tokenColor(page, extendError, 'color', '--destructive')
    await expect(minutes).toHaveAttribute('aria-invalid', 'true')
    await tokenColor(page, minutes, 'border-top-color', '--destructive')
    await capture(page, '08-dialogo-estender-rodada')
    await page.keyboard.press('Escape')

    await page.goto('/organizer/users')
    await page.getByTestId('organizer-users-reset-password-u-1').click()
    const resetDialog = page.getByTestId('organizer-users-reset-password-dialog-u-1')
    await expect(resetDialog).toBeVisible()
    await expect(resetDialog).toHaveCSS('box-shadow', 'none')
    // Deliberately ink: crimson would read as danger where the organizer is
    // restoring a participant's access (plan, close of T7).
    const submit = page.getByTestId('organizer-users-reset-password-submit-u-1')
    await tokenColor(page, submit, 'background-color', '--primary')
    await capture(page, '11-dialogo-redefinir-senha')
    await page.keyboard.press('Escape')

    await page.goto('/organizer/event-config')
    await page.getByTestId('event-config-codes-edit-pucrs').click()
    const codesDialog = page.getByTestId('event-config-codes-edit-dialog')
    await expect(codesDialog).toBeVisible()
    await expect(codesDialog).toHaveCSS('box-shadow', 'none')
    // § 4 puts event codes in Mono.
    await expect(page.getByTestId('event-config-codes-edit-code')).toHaveCSS('font-size', '13px')
    const family = await page
      .getByTestId('event-config-codes-edit-code')
      .evaluate((node) => getComputedStyle(node).fontFamily)
    expect(family.toLowerCase()).toContain('mono')
    await capture(page, '12-dialogo-codigos-evento')
  })

  test('the event rules screen wears the field labels', async ({ page, request }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/event-config')
    await expect(page.getByTestId('event-config-mixing-switch')).toBeVisible()

    for (const testId of ['event-config-mixing-switch', 'event-config-max-team-size-input']) {
      const id = await page.getByTestId(testId).getAttribute('id')
      const label = page.locator(`label[for="${id}"]`)
      await expect(label).toHaveCSS('font-size', '13px')
      await expect(label).toHaveCSS('font-weight', '500')
    }
    expect(
      Math.round(
        (await page.getByTestId('event-config-max-team-size-input').boundingBox())?.height ?? 0,
      ),
    ).toBe(36)

    await capture(page, '14-regras-do-evento')
  })

  // Criterion 6 — the forms and every one of the ten overlays fit a phone, in
  // all three languages, with no horizontal scroll anywhere.
  test('nothing scrolls sideways on a phone, in any language', async ({ page, request }) => {
    test.slow()
    await installPanel(page, request)
    await page.setViewportSize(PHONE)
    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form')).toBeVisible()

    for (const language of LANGUAGES) {
      await switchLanguage(page, language)

      for (const [route, anchor] of [
        ['/organizer/problems/new', 'problem-form'],
        ['/organizer/rounds/new', 'round-form'],
        ['/organizer/event-config', 'event-config-mixing-switch'],
      ] as const) {
        await page.goto(route)
        // Not `networkidle`: the panel holds an SSE stream open, so the page
        // never reaches it. An anchor testid is the real readiness signal.
        await expect(page.getByTestId(anchor)).toBeVisible()
        await noOverflow(page)
        await noPanelOverflow(page)
      }

      // Each overlay, opened in turn. With an open round, "Abrir" is disabled
      // and "Encerrar"/"Estender" exist; without one it is the other way
      // round, so the rounds fixture is swapped between the two groups.
      const withOpenRound: [string, string, string][] = [
        [
          '/organizer/problems',
          'organizer-problems-archive-p-easy',
          'organizer-problems-archive-confirm',
        ],
        ['/organizer/rounds', 'organizer-rounds-close-r-open', 'organizer-rounds-close-confirm'],
        ['/organizer/rounds', 'organizer-rounds-extend-r-open', 'organizer-rounds-extend-dialog'],
        [
          '/organizer/teams',
          'team-moderation-remove-team-action-t-1',
          'team-moderation-remove-team-confirm-t-1',
        ],
        [
          '/organizer/teams',
          'team-moderation-remove-member-action-u-1',
          'team-moderation-remove-member-confirm-u-1',
        ],
        ['/organizer/users', 'organizer-users-deactivate-u-1', 'organizer-users-confirm-u-1'],
        [
          '/organizer/users',
          'organizer-users-reset-password-u-1',
          'organizer-users-reset-password-dialog-u-1',
        ],
        ['/organizer/event-config', 'event-config-mixing-switch', 'event-config-mixing-confirm'],
        [
          '/organizer/event-config',
          'event-config-codes-edit-pucrs',
          'event-config-codes-edit-dialog',
        ],
      ]

      async function openEach(overlays: [string, string, string][]) {
        for (const [route, trigger, overlay] of overlays) {
          await page.goto(route)
          await page.getByTestId(trigger).click()
          await expect(page.getByTestId(overlay)).toBeVisible()
          await noOverflow(page)
          await page.keyboard.press('Escape')
        }
      }

      await openEach(withOpenRound)

      await setRounds(page, false)
      await openEach([
        ['/organizer/rounds', 'organizer-rounds-open-r-draft', 'organizer-rounds-open-confirm'],
      ])
      await setRounds(page, true)
    }

    await switchLanguage(page, 'pt')

    // The breakpoint gets the same treatment, where the panel has least room.
    await page.setViewportSize(BREAKPOINT)
    for (const [route, anchor] of [
      ['/organizer/problems/new', 'problem-form'],
      ['/organizer/rounds/new', 'round-form'],
    ] as const) {
      await page.goto(route)
      await expect(page.getByTestId(anchor)).toBeVisible()
      await noOverflow(page)
      await noPanelOverflow(page)
    }
  })

  // Criterion 8 — `--destructive` and `--brand-text` take different values in
  // the dark theme, so the colour assertions have to run again there.
  test('dark theme: the same crimson and the same brand, re-resolved', async ({
    page,
    request,
  }) => {
    await installPanel(page, request, { theme: 'dark' })
    await page.setViewportSize(DESKTOP)

    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form')).toBeVisible()
    await tokenColor(page, page.getByTestId('problem-form-publish'), 'background-color', '--brand')

    await page.getByTestId('problem-form-points').fill('0')
    await page.getByTestId('problem-form-save').click()
    const message = page.getByTestId('problem-form-points-error')
    await expect(message).toBeVisible()
    await tokenColor(page, message, 'color', '--destructive')
    await capture(page, '15-formularios-escuro')

    await page.goto('/organizer/problems')
    await page.getByTestId('organizer-problems-archive-p-easy').click()
    const archive = page.getByTestId('organizer-problems-archive-confirm')
    await expect(archive).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await tokenColor(page, archive, 'border-top-color', '--destructive')
  })
})
