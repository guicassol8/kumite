import { expect, test } from '@playwright/test'
import { ORGANIZER_NAME } from './support/rounds'

// Visual evidence for #185, Acceptance 4: teams stored with a blank name
// *before* this fix must stay identifiable on the organizer's moderation
// screen. Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD and skips itself without
// them, like every other organizer spec here.
//
// The two blank teams come from an intercepted `GET /organizer/teams` rather
// than from the API, and that is the point: after #185 no route will ever
// create one again — `POST /teams` and `PATCH /organizer/teams/:id` both
// answer 422 — so legacy rows are the only way this state exists, and an
// intercept is the only way to put one in front of the browser. The same
// pattern the #194 spec uses for the bug-report cooldown.
const evidence = (name: string) => `e2e/evidence/185/${name}.png`

// Scoped to the API origin, not a bare `**/organizer/teams`: the front serves
// its own SPA at the very same path, and a glob that loose swallows the
// document navigation too and leaves the browser on a page of JSON.
const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const BLANK_A = 'aaaaaaaa-1111-2222-3333-444444444444'
const BLANK_B = 'bbbbbbbb-1111-2222-3333-444444444444'

const legacyTeams = {
  maxTeamSize: 3,
  teams: [
    {
      // Stored as three spaces by the old code path.
      id: BLANK_A,
      name: '   ',
      frozen: false,
      slotsAvailable: 2,
      members: [
        {
          userId: 'u1',
          email: 'ada@edu.pucrs.br',
          name: 'Ada Lovelace',
          university: 'pucrs',
          role: 'participant',
        },
      ],
    },
    {
      // And this one as the empty string — a different row, the same absence.
      id: BLANK_B,
      name: '',
      frozen: false,
      slotsAvailable: 2,
      members: [
        {
          userId: 'u2',
          email: 'alan@merida.edu.mx',
          name: 'Alan Turing',
          university: 'merida',
          role: 'participant',
        },
      ],
    },
    {
      id: 'cccccccc-1111-2222-3333-444444444444',
      name: 'Blockly Busters',
      frozen: false,
      slotsAvailable: 1,
      members: [
        {
          userId: 'u3',
          email: 'grace@edu.pucrs.br',
          name: 'Grace Hopper',
          university: 'pucrs',
          role: 'participant',
        },
      ],
    },
  ],
}

test.describe('organizer moderation of blank-named teams (#185)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('labels two legacy blank teams apart and refuses a blank rename', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)

    await page.route(`${BACK_URL}/organizer/teams`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(legacyTeams),
      })
    })

    // 03 — both blank teams carry a readable label, and the two labels differ:
    // before #185 both cards came up with no title at all, which is what left
    // the organizer unable to tell which one he was renaming.
    await page.goto('/organizer/teams')
    const first = page.getByTestId(`team-moderation-name-${BLANK_A}`)
    const second = page.getByTestId(`team-moderation-name-${BLANK_B}`)
    await expect(first).toContainText('Time sem nome')
    await expect(second).toContainText('Time sem nome')
    await expect(first).toContainText('aaaaaaaa')
    await expect(second).toContainText('bbbbbbbb')
    expect(await first.textContent()).not.toEqual(await second.textContent())
    await expect(page.getByTestId(`team-moderation-rename-start-${BLANK_A}`)).toBeVisible()
    await expect(page.getByTestId(`team-moderation-rename-start-${BLANK_B}`)).toBeVisible()
    await page.screenshot({ path: evidence('03-moderacao-times-sem-nome'), fullPage: true })

    // 04 — and renaming one of them to nothing but spaces is refused inline,
    // on the field, without a request leaving the browser.
    let patched = false
    await page.route(`${BACK_URL}/organizer/teams/${BLANK_A}`, async (route) => {
      patched = true
      await route.fallback()
    })
    await page.getByTestId(`team-moderation-rename-start-${BLANK_A}`).click()
    await page.getByTestId(`team-moderation-rename-input-${BLANK_A}`).fill('   ')
    await page.getByTestId(`team-moderation-rename-save-${BLANK_A}`).click()
    await expect(page.getByTestId(`team-moderation-rename-error-${BLANK_A}`)).toContainText(
      'Informe o nome do time',
    )
    expect(patched).toBe(false)
    await page.screenshot({ path: evidence('04-moderacao-rename-em-branco'), fullPage: true })
  })
})
