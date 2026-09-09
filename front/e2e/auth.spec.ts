import { expect, test } from '@playwright/test'
import { E2E_PARTICIPANT_NAME, ORGANIZER_NAME } from './support/rounds'

// Visual walkthrough for #28. Prereqs (like auth.hurl):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// db:seed requires ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment —
// the seeded-organizer test below reads the same two vars to log in as that
// account, and skips itself when they aren't set.
const evidence = (name: string) => `e2e/evidence/28/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

function uniqueEmail(): string {
  return `e2e-${Date.now()}@edu.pucrs.br`
}

async function fillSignupForm(page: import('@playwright/test').Page, email: string) {
  await page.getByTestId('signup-name-input').fill('E2E Participante')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill('supersecret')
  await page.getByTestId('signup-confirm-password-input').fill('supersecret')
  await page.getByTestId('signup-code-input').fill('PUCRS2026')
}

test('signup happy path auto-logs in and shows the name in the header', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/signup')
  await fillSignupForm(page, email)
  await page.screenshot({ path: evidence('01-signup-filled'), fullPage: true })

  await page.getByTestId('signup-submit-button').click()

  await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
  await page.screenshot({ path: evidence('02-signup-auto-logged-in'), fullPage: true })
})

test('signup with a mismatched email suffix shows an inline field error', async ({ page }) => {
  await page.goto('/signup')
  await fillSignupForm(page, 'someone@merida.edu.mx')

  await page.getByTestId('signup-submit-button').click()

  await expect(page.getByTestId('signup-email-error')).toBeVisible()
  await page.screenshot({ path: evidence('03-signup-domain-mismatch'), fullPage: true })
})

test('login with the wrong password shows a single generic error', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/signup')
  await fillSignupForm(page, email)
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
  await page.getByTestId('header-logout-button').click()

  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill('wrong-password')
  await page.getByTestId('login-submit-button').click()

  await expect(page.getByTestId('login-form-error')).toBeVisible()
  await page.screenshot({ path: evidence('04-login-wrong-password'), fullPage: true })
})

test('the password-visibility toggle reveals and re-hides the typed password', async ({ page }) => {
  await page.goto('/login')
  const passwordInput = page.getByTestId('login-password-input')
  await passwordInput.fill('supersecret')
  await expect(passwordInput).toHaveAttribute('type', 'password')

  await page.getByTestId('login-password-input-toggle').click()
  await expect(passwordInput).toHaveAttribute('type', 'text')
  await expect(passwordInput).toHaveValue('supersecret')
  await page.screenshot({ path: evidence('05-password-visible') })

  await page.getByTestId('login-password-input-toggle').click()
  await expect(passwordInput).toHaveAttribute('type', 'password')
})

test('a fresh participant hitting /organizer is redirected home with the forbidden notice', async ({
  page,
}) => {
  const email = uniqueEmail()
  await page.goto('/signup')
  await fillSignupForm(page, email)
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)

  await page.goto('/organizer')

  await expect(page).toHaveURL(/\/\?notice=forbidden-organizer/)
  await expect(page.getByTestId('home-notice-banner')).toBeVisible()
  await page.screenshot({ path: evidence('06-organizer-blocked-for-participant'), fullPage: true })
})

test.describe('seeded organizer account', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('logs in, reaches the /organizer panel, and logs out back to anonymous', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)

    await page.goto('/organizer')
    await expect(page.getByTestId('organizer-heading')).toBeVisible()
    await page.screenshot({ path: evidence('07-organizer-stub-visible'), fullPage: true })

    await page.getByTestId('header-logout-button').click()
    await expect(page.getByTestId('header-login-link')).toBeVisible()
    await page.screenshot({ path: evidence('08-logged-out'), fullPage: true })
  })
})
