import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #94: an id typed (or pasted) into the URL that isn't
// a uuid now stops at the API's input validation as a 422 instead of blowing
// up in Postgres as a 500 — and the four screens whose id comes from the URL
// render their existing "not found" state for it, never the generic
// "something went wrong". Prereqs (like organizer-rounds.spec.ts):
//   docker compose up -d && pnpm db:migrate
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD for the two organizer screens.
const evidence = (name: string) => `e2e/evidence/94/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const MALFORMED = 'nao-e-uuid'
const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `uuid-e2e-participant-${stamp}@edu.pucrs.br`

test.describe('malformed id in the URL (#94)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function signupThroughUi(page: Page, email: string) {
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(email)
  }

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_EMAIL)
  }

  test('the four id-in-the-URL screens answer not-found instead of erroring', async ({ page }) => {
    await signupThroughUi(page, participantEmail)

    // 01 — the API itself: the two routes the issue caught 500ing in
    // production now answer 422 at the edge, which is what the screens below
    // are reacting to. Authenticated on purpose — the auth middleware runs
    // before input validation, so an anonymous probe only ever proves 401.
    const token = await page.evaluate(() => window.localStorage.getItem('kumite-token'))
    const headers = { authorization: `Bearer ${token}` }
    const roundStatus = (
      await page.request.get(`${BACK_URL}/rounds/${MALFORMED}`, { headers })
    ).status()
    const rankingStatus = (
      await page.request.get(`${BACK_URL}/rounds/${MALFORMED}/ranking`, { headers })
    ).status()
    expect([roundStatus, rankingStatus]).toEqual([422, 422])

    // 02 — participant round detail: the "round not found" state, not the
    // generic load error.
    await page.goto(`/rounds/${MALFORMED}`)
    await expect(page.getByTestId('round-detail-not-found')).toBeVisible()
    await page.screenshot({ path: evidence('01-rodada-nao-encontrada'), fullPage: true })

    // 03 — participant problem screen, same treatment.
    await page.goto(`/problem/${MALFORMED}`)
    await expect(page.getByTestId('problem-not-found')).toBeVisible()
    await page.screenshot({ path: evidence('02-problema-nao-encontrado'), fullPage: true })

    // 04 — organizer round edit form.
    await loginAsOrganizer(page)
    await page.goto(`/organizer/rounds/${MALFORMED}/edit`)
    await expect(page.getByTestId('round-form-not-found')).toBeVisible()
    await expect(page.getByTestId('round-form')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-editar-rodada-nao-encontrada'), fullPage: true })

    // 05 — organizer problem edit form.
    await page.goto(`/organizer/problems/${MALFORMED}/edit`)
    await expect(page.getByTestId('problem-form-not-found')).toBeVisible()
    await expect(page.getByTestId('problem-form')).toHaveCount(0)
    await page.screenshot({ path: evidence('04-editar-problema-nao-encontrado'), fullPage: true })
  })
})
