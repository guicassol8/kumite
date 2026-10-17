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

// #458 — "Hairlines de 1 px, sem sombra além do anel de foco"
// (`docs/design/identity.md` § 5). The form controls (Input, Textarea,
// PasswordInput, SelectTrigger, Checkbox, Switch and the Button variants) used
// to rest on shadcn's `shadow-xs`. At rest their computed `box-shadow` is now
// `none`; keyboard focus still draws the 3 px ring, and an invalid field still
// turns border and ring crimson. jsdom never applies Tailwind, so the computed
// shadow can only be settled here.
//
// The anonymous surfaces always run. The participant ones sign up through the
// API; the organizer ones skip without the seeded organizer, like the rest of
// the suite.
const evidence = (name: string) => `e2e/evidence/458/${name}.png`

type TeamsResponse = InferResponseType<typeof api.teams.$get, 200>

const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const
type Viewport = (typeof VIEWPORTS)[number]

const PASSWORD = 'supersecret'
/** The ring's spread in the computed shadow list: `… 0px 0px 0px 3px`. */
const RING_3PX = /\s3px/

/** The literal `rgb(...)` a token resolves to in the current theme (see field-fill-identity.spec.ts). */
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

/** Acceptance 1 — no focus, no hover: the control casts no shadow at all. */
async function expectRest(page: Page, control: Locator) {
  await expect(control).toBeVisible()
  await page.mouse.move(0, 0)
  await control.evaluate((element) => (element as HTMLElement).blur())
  await expect(control).toHaveCSS('box-shadow', 'none')
}

/**
 * Keyboard focus. A key press first puts Chromium in keyboard modality, so a
 * programmatic focus on a button matches `:focus-visible` like a Tab would.
 */
async function focusByKeyboard(page: Page, control: Locator) {
  await page.keyboard.press('Shift')
  await control.focus()
}

/** Acceptance 2 — the focus ring is still there, 3 px wide. */
async function expectFocusRing(page: Page, control: Locator) {
  await focusByKeyboard(page, control)
  // `toHaveCSS` retries, which also waits out the `box-shadow` transition.
  await expect(control).toHaveCSS('box-shadow', RING_3PX)
  await control.evaluate((element) => (element as HTMLElement).blur())
}

async function expectRestAndFocus(page: Page, control: Locator) {
  await expectRest(page, control)
  await expectFocusRing(page, control)
  await expectRest(page, control)
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

async function participant(request: APIRequestContext) {
  const email = `shadow-${Date.now()}-${Math.random().toString(36).slice(2)}@edu.pucrs.br`
  const signup = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'E2E Participante', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(signup.ok()).toBeTruthy()
  return { email, token: await apiToken(request, email, PASSWORD) }
}

/** The participant's own team plus an open one, so leave and join both draw. */
function teamsFixture(email: string, inTeam: boolean): TeamsResponse {
  const member = { university: 'pucrs' as const, name: 'E2E Participante', email }
  const other = { university: 'merida' as const, name: 'Luis Pech', email: 'luis@merida.edu.mx' }
  return {
    maxTeamSize: 4,
    mixingLocked: false,
    myTeamId: inTeam ? 'mine' : null,
    teams: [
      ...(inTeam
        ? [
            {
              id: 'mine',
              name: 'Byte Fighters',
              members: [member],
              slotsAvailable: 3,
              frozen: false,
              joinBlockedReason: 'already_in_team' as const,
            },
          ]
        : []),
      {
        id: 'open',
        name: 'Loop Lovers',
        members: [other],
        slotsAvailable: 3,
        frozen: false,
        joinBlockedReason: inTeam ? ('already_in_team' as const) : null,
      },
    ],
  }
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
    test.describe(`${theme} ${viewport.width}px controls rest without a shadow (#458)`, () => {
      test.use({ viewport })

      test.beforeEach(async ({ page }) => {
        await useTheme(page, theme)
      })

      test('login: Input, PasswordInput, default and secondary Button', async ({ page }) => {
        await page.goto('/login')
        const controls = [
          page.getByTestId('login-email-input'),
          page.getByTestId('login-password-input'),
          page.getByTestId('login-submit-button'),
          // The active language is the `secondary` variant; the others are ghost.
          page.locator('[data-testid^="language-option-"][aria-current="true"]'),
        ]
        for (const control of controls) await expectRest(page, control)
        await capture(
          page,
          shot({ 'light-1280': '01-login-claro', 'dark-1280': '02-login-escuro' }, theme, viewport),
        )
        for (const control of controls) await expectFocusRing(page, control)
      })

      test('login error: crimson border at rest, crimson 3 px ring on focus', async ({ page }) => {
        await page.goto('/login')
        const email = page.getByTestId('login-email-input')
        const password = page.getByTestId('login-password-input')
        // Only the password is left invalid, so the email is the valid reference.
        await email.fill('ada.lovelace@edu.pucrs.br')
        await page.getByTestId('login-submit-button').click()
        await expect(password).toHaveAttribute('aria-invalid', 'true')
        await expect(email).not.toHaveAttribute('aria-invalid', 'true')
        const crimson = await tokenRgb(page, '--destructive')

        // At rest: the border alone says "error"; no ring, no shadow.
        await expectRest(page, password)
        await expect(password).toHaveCSS('border-top-color', crimson)

        // The valid field's focus ring, as the reference.
        await focusByKeyboard(page, email)
        await expect(email).toHaveCSS('box-shadow', RING_3PX)
        const validRing = await email.evaluate((element) => getComputedStyle(element).boxShadow)

        await focusByKeyboard(page, password)
        await expect(password).toHaveCSS('box-shadow', RING_3PX)
        await expect(password).toHaveCSS('border-top-color', crimson)
        const invalidRing = await password.evaluate(
          (element) => getComputedStyle(element).boxShadow,
        )
        expect(invalidRing).not.toBe(validRing)
        await capture(
          page,
          shot(
            { 'light-1280': '03-erro-foco-claro', 'dark-1280': '04-erro-foco-escuro' },
            theme,
            viewport,
          ),
        )
      })

      test('bug report dialog: Textarea and its submit Button', async ({ page }) => {
        await page.goto('/')
        await openBugReport(page, viewport)
        for (const testId of ['bug-report-description', 'bug-report-submit']) {
          await expectRestAndFocus(page, page.getByTestId(testId))
        }
      })

      test('participant: destructive, outline and default Buttons on /teams and /', async ({
        page,
        request,
      }) => {
        const { email, token } = await participant(request)
        await signInAs(page, token)
        let inTeam = true
        await page.route(`${BACK_URL}/teams`, (route) =>
          route.request().method() === 'GET'
            ? route.fulfill({ json: teamsFixture(email, inTeam) })
            : route.continue(),
        )

        await page.goto('/teams')
        const leave = page.getByTestId('my-team-leave')
        const joinBlocked = page.getByTestId('teams-join-open')
        await expectRestAndFocus(page, leave)
        // Disabled while the participant has a team: it cannot take focus, only rest.
        await expect(joinBlocked).toBeDisabled()
        await expectRest(page, joinBlocked)
        await capture(
          page,
          shot({ 'light-1280': '05-times-claro', 'dark-1280': '06-times-escuro' }, theme, viewport),
        )

        inTeam = false
        await page.reload()
        await expectRestAndFocus(page, page.getByTestId('teams-create-open'))
        await expect(page.getByTestId('teams-join-open')).toBeEnabled()
        await expectRestAndFocus(page, page.getByTestId('teams-join-open'))

        await page.goto('/')
        await expectRestAndFocus(page, page.getByTestId('home-team-cta'))
      })

      if (viewport.width < 768) {
        test('mobile menu: the theme Switch', async ({ page }) => {
          await page.goto('/login')
          await page.getByTestId('header-mobile-menu-trigger').click()
          const toggle = page.getByTestId('header-mobile-theme-toggle')
          await expectRestAndFocus(page, toggle)
          await capture(
            page,
            shot({ 'dark-390': '07-menu-celular-switch-escuro' }, theme, viewport),
          )
        })
      }

      test.describe('organizer panel', () => {
        test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

        test.beforeEach(async ({ page, request }) => {
          await signInAs(page, await apiToken(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD))
        })

        test('problem form: the hidden-case Checkbox', async ({ page }) => {
          await page.goto('/organizer/problems/new')
          await expect(page.getByTestId('problem-form')).toBeVisible()
          await page.getByTestId('problem-form-add-case').click()
          const hidden = page.getByTestId('problem-form-case-0-hidden')
          await expectRestAndFocus(page, hidden)
          await capture(page, shot({ 'dark-1280': '08-problema-checkbox-escuro' }, theme, viewport))
        })

        test('event config: the submissions-paused Switch', async ({ page }) => {
          await page.goto('/organizer/event-config')
          const paused = page.getByTestId('event-config-submissions-paused-switch')
          await expectRestAndFocus(page, paused)
          await capture(
            page,
            shot({ 'light-1280': '09-event-config-switch-claro' }, theme, viewport),
          )
        })

        test('team moderation: the move-member SelectTrigger', async ({ page }) => {
          // Painted, not exercised: the reads are served so both teams exist.
          await page.route(`${BACK_URL}/organizer/teams`, (route) =>
            route.fulfill({ json: organizerTeams }),
          )
          await page.goto('/organizer/teams')
          await expectRestAndFocus(page, page.getByTestId('team-moderation-move-select-u-1'))
        })
      })
    })
  }
}
