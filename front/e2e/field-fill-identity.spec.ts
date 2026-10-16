import type { APIRequestContext, Locator, Page } from '@playwright/test'

import { AA_NORMAL, contrastRatio, measure, settle } from './support/contrast'
import {
  BACK_URL,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// #313 — every form field takes the `card` fill the identity gives "cards,
// inputs, tabelas" (`docs/design/identity.md` § 3) and the components board
// draws (`.input { background: var(--card) }`), in both themes, on paper, in a
// card and inside a dialog. An invalid field changes its border, never its
// fill (§ 3, Regra 1: "erro é contorno"). jsdom never applies Tailwind, so the
// computed fill and the contrast of typed text can only be settled here.
//
// The anonymous surfaces always run. The participant ones sign up through the
// API; the organizer ones skip without the seeded organizer, like the rest of
// the suite.
const evidence = (name: string) => `e2e/evidence/313/${name}.png`

const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const
type Viewport = (typeof VIEWPORTS)[number]

const PASSWORD = 'supersecret'

/**
 * The literal `rgb(...)` a token resolves to in the current theme, read off a
 * throwaway probe — the token may be a hex, an `oklch()` or another `var()`,
 * and only the engine knows what `toHaveCSS` compares against. Needs a loaded
 * document: on `about:blank` there is no stylesheet.
 */
async function tokenRgb(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    probe.style.backgroundColor = `var(${name})`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).backgroundColor
    probe.remove()
    return value
  }, token)
}

/** Acceptance 1 — the field's own fill is the `card` token. */
async function expectCardFill(page: Page, field: Locator) {
  await expect(field).toBeVisible()
  await expect(field).toHaveCSS('background-color', await tokenRgb(page, '--card'))
}

/** Acceptance 4 — typed text over the field's effective background reaches AA. */
async function expectReadable(page: Page, field: Locator, value?: string) {
  if (value !== undefined) await field.fill(value)
  await settle(page)
  const { text, background } = await measure(field)
  expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(AA_NORMAL)
}

/**
 * Acceptance 2 — crimson outline and crimson message, and the fill stays
 * `card`: no red fill. `message` is the field's error text, when it has a testid.
 */
async function expectErrorOutlineOnly(page: Page, field: Locator, message?: Locator) {
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  // react-hook-form focuses the first invalid field; the focus ring repaints
  // the border, so the error is read with the field at rest.
  await field.evaluate((element) => (element as HTMLElement).blur())
  await settle(page)
  const crimson = await tokenRgb(page, '--destructive')
  await expect(field).toHaveCSS('border-top-color', crimson)
  await expect(field).toHaveCSS('background-color', await tokenRgb(page, '--card'))
  if (message) await expect(message).toHaveCSS('color', crimson)
}

async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => localStorage.setItem('kumite:theme', value), theme)
}

/** Only the plan's numbered captures are taken; the other combinations just assert. */
async function capture(page: Page, name: string | undefined) {
  if (!name) return
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: evidence(name), fullPage: true })
}

function shot(
  names: Partial<Record<`${Theme}-${Viewport['width']}`, string>>,
  theme: Theme,
  viewport: Viewport,
) {
  return names[`${theme}-${viewport.width}`]
}

/** The header's trigger, or the mobile menu's below `md` (where the header hides it). */
async function openBugReport(page: Page, viewport: Viewport) {
  if (viewport.width >= 768) {
    await page.getByTestId('header-bug-report-trigger').click()
  } else {
    await page.getByTestId('header-mobile-menu-trigger').click()
    await page.getByTestId('header-mobile-bug-report-trigger').click()
  }
  await expect(page.getByTestId('bug-report-dialog')).toBeVisible()
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

async function participantToken(request: APIRequestContext) {
  const email = `fill-${Date.now()}-${Math.random().toString(36).slice(2)}@edu.pucrs.br`
  const signup = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'E2E Participante', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(signup.ok()).toBeTruthy()
  return apiToken(request, email, PASSWORD)
}

/** Two teams, so every member row has a destination and draws its move select. */
const organizerTeams = {
  maxTeamSize: 4,
  teams: [
    {
      id: 't-1',
      name: 'Blockly Busters',
      frozen: false,
      slotsAvailable: 3,
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
    {
      id: 't-2',
      name: 'Loop Lovers',
      frozen: false,
      slotsAvailable: 3,
      members: [
        {
          userId: 'u-2',
          email: 'grace.hopper@edu.pucrs.br',
          name: 'Grace Hopper',
          university: 'pucrs',
          role: 'participant',
        },
      ],
    },
  ],
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${theme} ${viewport.width}px form fields take the card fill (#313)`, () => {
      test.use({ viewport })

      test.beforeEach(async ({ page }) => {
        await useTheme(page, theme)
      })

      test('login: card fill, readable text, error only on the outline', async ({ page }) => {
        await page.goto('/login')
        const email = page.getByTestId('login-email-input')
        const password = page.getByTestId('login-password-input')
        for (const field of [email, password]) await expectCardFill(page, field)

        await page.getByTestId('login-submit-button').click()
        const passwordError = page.getByTestId('login-password-error')
        await expect(passwordError).toBeVisible()
        await expectErrorOutlineOnly(page, password, passwordError)
        await capture(
          page,
          shot(
            { 'light-1280': '05-erro-login-claro', 'dark-1280': '06-erro-login-escuro' },
            theme,
            viewport,
          ),
        )

        await expectReadable(page, email, 'ada.lovelace@edu.pucrs.br')
        await expectReadable(page, password, 'supersecret')
        await capture(
          page,
          shot({ 'light-1280': '01-login-claro', 'dark-1280': '02-login-escuro' }, theme, viewport),
        )
      })

      test('signup and reset-password: card fill and readable text', async ({ page }) => {
        await page.goto('/signup')
        const values: [string, string][] = [
          ['signup-name-input', 'Ada Lovelace'],
          ['signup-email-input', 'ada.lovelace@edu.pucrs.br'],
          ['signup-password-input', 'supersecret'],
          ['signup-confirm-password-input', 'supersecret'],
          ['signup-code-input', 'PUCRS2026'],
        ]
        for (const [testId, value] of values) {
          const field = page.getByTestId(testId)
          await expectCardFill(page, field)
          await expectReadable(page, field, value)
        }
        await capture(
          page,
          shot(
            { 'light-390': '03-cadastro-celular-claro', 'dark-390': '04-cadastro-celular-escuro' },
            theme,
            viewport,
          ),
        )

        await page.goto('/reset-password')
        const resetEmail = page.getByTestId('reset-password-request-email-input')
        await expectCardFill(page, resetEmail)
        await expectReadable(page, resetEmail, 'ada.lovelace@edu.pucrs.br')
      })

      test('bug report dialog: card fill, and an empty description is an outline', async ({
        page,
      }) => {
        await page.goto('/')
        await openBugReport(page, viewport)
        const description = page.getByTestId('bug-report-description')
        const email = page.getByTestId('bug-report-email')
        for (const field of [description, email]) await expectCardFill(page, field)

        await page.getByTestId('bug-report-submit').click()
        await expectErrorOutlineOnly(page, description)

        await expectReadable(page, description, 'o editor de blocos travou')
        await expectReadable(page, email, 'ada.lovelace@edu.pucrs.br')
        await capture(
          page,
          shot(
            { 'light-1280': '07-bug-report-claro', 'dark-1280': '08-bug-report-escuro' },
            theme,
            viewport,
          ),
        )
      })

      test('participant: the create-team dialog and change-password', async ({ page, request }) => {
        await signInAs(page, await participantToken(request))
        // Whatever teams other specs left behind, creating stays allowed here.
        await page.route(`${BACK_URL}/teams`, (route) =>
          route.request().method() === 'GET'
            ? route.fulfill({
                json: { maxTeamSize: 3, mixingLocked: false, myTeamId: null, teams: [] },
              })
            : route.continue(),
        )
        await page.goto('/teams')
        await page.getByTestId('teams-create-open').click()
        await expect(page.getByTestId('teams-create-dialog')).toBeVisible()
        const name = page.getByTestId('teams-create-name-input')
        await expectCardFill(page, name)
        await expectReadable(page, name, 'Blockly Busters')
        await capture(page, shot({ 'dark-1280': '09-times-criar-escuro' }, theme, viewport))
        await page.keyboard.press('Escape')

        await page.goto('/change-password')
        for (const testId of [
          'change-password-current-input',
          'change-password-new-input',
          'change-password-confirm-input',
        ]) {
          const field = page.getByTestId(testId)
          await expectCardFill(page, field)
          await expectReadable(page, field, 'supersecret')
        }
        await capture(page, shot({ 'dark-1280': '10-trocar-senha-escuro' }, theme, viewport))
      })

      test.describe('organizer panel', () => {
        test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

        test.beforeEach(async ({ page, request }) => {
          await signInAs(page, await apiToken(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD))
        })

        test('problem form: Input and statement Textarea, invalid points as an outline', async ({
          page,
        }) => {
          await page.goto('/organizer/problems/new')
          await expect(page.getByTestId('problem-form')).toBeVisible()
          const points = page.getByTestId('problem-form-points')
          const statement = page.getByTestId('problem-form-statement-pt')
          for (const field of [points, statement]) await expectCardFill(page, field)

          await points.fill('0')
          await page.getByTestId('problem-form-save').click()
          const pointsError = page.getByTestId('problem-form-points-error')
          await expect(pointsError).toBeVisible()
          await expectErrorOutlineOnly(page, points, pointsError)

          await expectReadable(page, statement, 'Some dois números inteiros.')
          await capture(
            page,
            shot(
              {
                'light-1280': '11-problema-formulario-claro',
                'dark-1280': '12-problema-formulario-escuro',
              },
              theme,
              viewport,
            ),
          )
        })

        test('users search on paper and the event-config field inside a card', async ({ page }) => {
          await page.goto('/organizer/users')
          const search = page.getByTestId('organizer-users-search-input')
          await expectCardFill(page, search)
          await expectReadable(page, search, 'ada')

          await page.goto('/organizer/event-config')
          const maxTeamSize = page.getByTestId('event-config-max-team-size-input')
          await expectCardFill(page, maxTeamSize)
          await expectReadable(page, maxTeamSize)
          await capture(page, shot({ 'dark-1280': '13-event-config-card-escuro' }, theme, viewport))
        })

        test('team moderation: the move-member SelectTrigger', async ({ page }) => {
          // Painted, not exercised: the reads are served so both teams exist.
          await page.route(`${BACK_URL}/organizer/teams`, (route) =>
            route.fulfill({ json: organizerTeams }),
          )
          await page.goto('/organizer/teams')
          const select = page.getByTestId('team-moderation-move-select-u-1')
          await expectCardFill(page, select)
          // The trigger shows its placeholder: the text a viewer reads over the fill.
          await expectReadable(page, select)
          await capture(page, shot({ 'dark-1280': '14-moderacao-select-escuro' }, theme, viewport))
        })
      })
    })
  }
}
