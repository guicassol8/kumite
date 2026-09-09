import { expect, type Page, test } from '@playwright/test'
import { ORGANIZER_NAME } from './support/rounds'

// Visual walkthrough for #143: the on-site reset an organizer performs for a
// participant who cannot reach their inbox. Prereqs (like organizer-users.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment and skips
// itself when they are not set.
const evidence = (name: string) => `e2e/evidence/143/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
// The dev DB is shared across worktrees and reruns — the stamp keeps every
// run's fixtures collision-free (same reasoning as organizer-users.spec.ts).
const stamp = Date.now().toString().slice(-6)
const participantEmail = `e2e-reset-${stamp}@edu.pucrs.br`

async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const { token } = (await res.json()) as { token: string }
  return token
}

async function apiSignupAndLogin(email: string, code: string): Promise<string> {
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Participante', email, password: PASSWORD, code }),
  })
  return apiLogin(email, PASSWORD)
}

async function apiMyId(token: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
  const { id } = (await res.json()) as { id: string }
  return id
}

async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(password)
  await page.getByTestId('login-submit-button').click()
}

test.describe('organizer-driven password reset', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('an organizer hands out a temporary password the participant must change', async ({
    browser,
  }) => {
    const participantId = await apiMyId(await apiSignupAndLogin(participantEmail, 'PUCRS2026'))
    const organizerId = await apiMyId(await apiLogin(ORGANIZER_EMAIL, ORGANIZER_PASSWORD))

    // Two contexts, because this is two people at one desk: the organizer's
    // session must stay signed in while the participant uses their own.
    const organizerContext = await browser.newContext()
    const participantContext = await browser.newContext()
    const organizerPage = await organizerContext.newPage()
    const participantPage = await participantContext.newPage()

    try {
      await loginThroughUi(organizerPage, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
      await expect(organizerPage.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)

      await organizerPage.goto('/organizer/users')
      await organizerPage.getByTestId('organizer-users-search-input').fill(participantEmail)
      await expect(organizerPage.getByTestId(`organizer-users-row-${participantId}`)).toBeVisible()
      await expect(
        organizerPage.getByTestId(`organizer-users-reset-password-${participantId}`),
      ).toBeEnabled()
      await organizerPage.screenshot({ path: evidence('01-participant-row'), fullPage: true })

      // Step one: the organizer re-authenticates. A wrong password is refused
      // with a single message that does not say whether it was the password or
      // the attempt ceiling.
      await organizerPage.getByTestId(`organizer-users-reset-password-${participantId}`).click()
      await expect(
        organizerPage.getByTestId(`organizer-users-reset-password-dialog-${participantId}`),
      ).toBeVisible()
      await organizerPage.screenshot({ path: evidence('02-step-up-dialog'), fullPage: true })

      await organizerPage
        .getByTestId(`organizer-users-reset-password-admin-password-input-${participantId}`)
        .fill('definitely-not-the-organizer-password')
      await organizerPage
        .getByTestId(`organizer-users-reset-password-submit-${participantId}`)
        .click()
      await expect(
        organizerPage.getByTestId(`organizer-users-reset-password-error-${participantId}`),
      ).toBeVisible()
      await organizerPage.screenshot({ path: evidence('03-wrong-admin-password'), fullPage: true })

      // Step two: the right password produces the temporary one, once.
      await organizerPage
        .getByTestId(`organizer-users-reset-password-admin-password-input-${participantId}`)
        .fill(ORGANIZER_PASSWORD)
      await organizerPage
        .getByTestId(`organizer-users-reset-password-submit-${participantId}`)
        .click()
      const resultValue = organizerPage.getByTestId(
        `organizer-users-reset-password-result-value-${participantId}`,
      )
      await expect(resultValue).toBeVisible()
      const temporaryPassword = ((await resultValue.textContent()) ?? '').trim()
      expect(temporaryPassword).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
      await organizerPage.screenshot({ path: evidence('04-temporary-password'), fullPage: true })

      // Closing discards it: reopening starts over at step one, and the
      // password is nowhere on the page.
      await organizerPage
        .getByTestId(`organizer-users-reset-password-close-${participantId}`)
        .click()
      await expect(resultValue).toHaveCount(0)
      await expect(organizerPage.getByText(temporaryPassword)).toHaveCount(0)
      await organizerPage.screenshot({ path: evidence('05-shown-once'), fullPage: true })

      // Another organizer is not a valid target — the button says why.
      await organizerPage.getByTestId('organizer-users-search-input').fill(ORGANIZER_EMAIL)
      await expect(organizerPage.getByTestId(`organizer-users-row-${organizerId}`)).toBeVisible()
      await expect(
        organizerPage.getByTestId(`organizer-users-reset-password-${organizerId}`),
      ).toBeDisabled()
      await organizerPage.screenshot({
        path: evidence('06-organizer-row-disabled'),
        fullPage: true,
      })

      // Now the participant's side. The old password is dead.
      await loginThroughUi(participantPage, participantEmail, PASSWORD)
      await expect(participantPage.getByTestId('login-form-error')).toBeVisible()
      await participantPage.screenshot({ path: evidence('07-old-password-dead'), fullPage: true })

      // The temporary one gets them in, straight onto the change screen.
      await participantPage.getByTestId('login-password-input').fill(temporaryPassword)
      await participantPage.getByTestId('login-submit-button').click()
      await expect(participantPage).toHaveURL(/\/change-password$/)
      await expect(participantPage.getByTestId('change-password-required-notice')).toBeVisible()
      await expect(participantPage.getByTestId('change-password-back-link')).toHaveCount(0)
      await participantPage.screenshot({ path: evidence('08-forced-change'), fullPage: true })

      // And there is no way around it: /teams bounces straight back.
      await participantPage.goto('/teams')
      await expect(participantPage).toHaveURL(/\/change-password$/)
      await participantPage.screenshot({ path: evidence('09-blocked-elsewhere'), fullPage: true })

      // Changing it clears the block and drops them on the home page.
      await participantPage.getByTestId('change-password-current-input').fill(temporaryPassword)
      await participantPage.getByTestId('change-password-new-input').fill('brand-new-password')
      await participantPage.getByTestId('change-password-confirm-input').fill('brand-new-password')
      await participantPage.getByTestId('change-password-submit-button').click()
      await expect(participantPage).toHaveURL(/localhost:\d+\/$/)
      await participantPage.screenshot({ path: evidence('10-back-home'), fullPage: true })

      await participantPage.goto('/teams')
      await expect(participantPage).toHaveURL(/\/teams$/)
      await participantPage.screenshot({ path: evidence('11-normal-access'), fullPage: true })
    } finally {
      await organizerContext.close()
      await participantContext.close()
    }
  })
})
