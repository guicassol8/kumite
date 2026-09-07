import { readFileSync } from 'node:fs'

import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #52. Prereqs (like organizer-problems.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment.
//
// The happy-path test additionally needs BACK_NOTIFICATIONS_LOG: a path to a
// file the running back server's stdout is redirected to. The OTP is never
// returned by any endpoint (no oracle, by design — see password-reset.hurl),
// so a real browser client only ever learns it the way a real user would:
// via the notification channel, which falls back to `console.log` when SES
// isn't configured (true for local dev/CI). Without that var, only the
// black-box-observable flows run (validation, generic invalid-otp error);
// the happy path skips itself rather than failing.
const evidence = (name: string) => `e2e/evidence/52/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const NOTIFICATIONS_LOG = process.env.BACK_NOTIFICATIONS_LOG ?? ''

function uniqueEmail(): string {
  return `reset-e2e-${Date.now()}@edu.pucrs.br`
}

async function fillForm(
  page: Page,
  values: { email: string; otp: string; newPassword: string; confirmPassword: string },
) {
  await page.getByTestId('reset-password-email-input').fill(values.email)
  await page.getByTestId('reset-password-otp-input').fill(values.otp)
  await page.getByTestId('reset-password-new-password-input').fill(values.newPassword)
  await page.getByTestId('reset-password-confirm-password-input').fill(values.confirmPassword)
}

test('mismatched passwords show an inline error, no request sent', async ({ page }) => {
  await page.goto('/reset-password')
  await fillForm(page, {
    email: 'someone@edu.pucrs.br',
    otp: '123456',
    newPassword: 'brandnewpassword',
    confirmPassword: 'somethingelse',
  })
  await page.getByTestId('reset-password-submit-button').click()

  await expect(page.getByTestId('reset-password-confirm-password-error')).toBeVisible()
  await page.screenshot({ path: evidence('01-validation-mismatch'), fullPage: true })
})

test('a wrong/unknown OTP shows a single generic error, no field blame', async ({ page }) => {
  await page.goto('/reset-password')
  await fillForm(page, {
    email: `nobody-${Date.now()}@edu.pucrs.br`,
    otp: '000000',
    newPassword: 'brandnewpassword',
    confirmPassword: 'brandnewpassword',
  })
  await page.getByTestId('reset-password-submit-button').click()

  await expect(page.getByTestId('reset-password-form-error')).toBeVisible()
  await page.screenshot({ path: evidence('02-invalid-otp-generic-error'), fullPage: true })
})

test.describe('organizer-triggered reset, completed with the real OTP', () => {
  test.skip(
    !ORGANIZER_EMAIL || !ORGANIZER_PASSWORD || !NOTIFICATIONS_LOG,
    'ORGANIZER_EMAIL/ORGANIZER_PASSWORD/BACK_NOTIFICATIONS_LOG not set',
  )

  async function organizerAuthHeader(): Promise<Record<string, string>> {
    const res = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
    })
    const { token } = (await res.json()) as { token: string }
    return { authorization: `Bearer ${token}` }
  }

  // The OTP only ever exists in the notification (console.log fallback here)
  // — poll the log tail for it instead of guessing a fixed delay.
  async function readOtpFromLog(email: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const content = readFileSync(NOTIFICATIONS_LOG, 'utf-8')
      const line = content
        .split('\n')
        .reverse()
        .find((l) => l.includes('[notifications]') && l.includes(email))
      const match = line?.match(/: (\d{6})$/)
      if (match?.[1]) return match[1]
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`expected an OTP notification for ${email} in ${NOTIFICATIONS_LOG}`)
  }

  test('full flow: organizer resets, user completes it with the emailed OTP, then logs in', async ({
    page,
  }) => {
    const email = uniqueEmail()
    const originalPassword = 'originalpass123'
    const newPassword = 'brandnewpassword456'

    const signupRes = await fetch(`${BACK_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: originalPassword, code: 'PUCRS2026' }),
    })
    const { id: userId } = (await signupRes.json()) as { id: string }

    const auth = await organizerAuthHeader()
    await fetch(`${BACK_URL}/organizer/users/${userId}/reset-password`, {
      method: 'POST',
      headers: auth,
    })

    const otp = await readOtpFromLog(email)

    await page.goto('/reset-password')
    await fillForm(page, { email, otp, newPassword, confirmPassword: newPassword })
    await page.screenshot({ path: evidence('03-reset-form-filled'), fullPage: true })
    await page.getByTestId('reset-password-submit-button').click()

    await expect(page.getByTestId('reset-password-success')).toBeVisible()
    await page.screenshot({ path: evidence('04-reset-success'), fullPage: true })

    await page.getByTestId('reset-password-login-link').click()
    await page.getByTestId('login-email-input').fill(email)
    await page.getByTestId('login-password-input').fill(newPassword)
    await page.getByTestId('login-submit-button').click()

    await expect(page.getByTestId('header-user-email')).toHaveText(email)
    await page.screenshot({ path: evidence('05-login-with-new-password'), fullPage: true })
  })
})
