import { expect, test } from '@playwright/test'

import { seedParticipantToken } from './support/editor-fixture'
import { BACK_URL, E2E_PARTICIPANT_NAME } from './support/rounds'

// Repro + visual walkthrough for #190: the password change succeeds (204) but
// the `GET /me` that follows it fails. The screen used to navigate to the home
// page anyway, leaving `mustChangePassword` stale in the store — so every
// guarded route bounced the participant straight back to /change-password,
// in a loop, with nothing on screen to explain it.
// Prereqs (like auth.spec.ts):
//   pnpm db:migrate && pnpm db:seed
// No organizer credentials needed: the voluntary mode of the screen runs the
// exact same post-204 refresh, and the forced mode is covered by vitest.
const evidence = (name: string) => `e2e/evidence/190/${name}.png`

const PASSWORD = 'supersecret'
const NEW_PASSWORD = 'brand-new-password'
const stamp = Date.now()
const participantEmail = `change-password-refresh-e2e-${stamp}@edu.pucrs.br`

async function apiSignupAndLogin(): Promise<string> {
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: E2E_PARTICIPANT_NAME,
      email: participantEmail,
      password: PASSWORD,
      code: 'PUCRS2026',
    }),
  })
  const res = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: participantEmail, password: PASSWORD }),
  })
  const { token } = (await res.json()) as { token: string }
  return token
}

test.describe('change-password refresh failure (#190)', () => {
  let token = ''

  test.beforeAll(async () => {
    token = await apiSignupAndLogin()
  })

  test('holds the user on the screen and recovers through a retry', async ({ page }) => {
    await seedParticipantToken(page, token)
    await page.goto('/change-password')
    // The route is only usable once hydration has run its own `/me` — killing
    // the endpoint before that would test #179's path, not this one.
    await expect(page.getByTestId('change-password-submit-button')).toBeVisible()

    // From here on `/me` dies at the network layer: the back restarting, or
    // the auditorium wifi dropping between the 204 and the refetch.
    await page.route('**/me', (route) => route.abort())

    await page.getByTestId('change-password-current-input').fill(PASSWORD)
    await page.getByTestId('change-password-new-input').fill(NEW_PASSWORD)
    await page.getByTestId('change-password-confirm-input').fill(NEW_PASSWORD)
    await page.getByTestId('change-password-submit-button').click()

    // 1. The password DID change, and the screen says so instead of dumping
    //    the user on a home page that would bounce them right back here.
    await expect(page.getByTestId('change-password-refresh-error')).toBeVisible()
    await expect(page).toHaveURL(/\/change-password/)
    // The form is gone on purpose: `currentPassword` is now the old password,
    // so re-submitting would answer 401 "senha atual incorreta".
    await expect(page.getByTestId('change-password-submit-button')).toHaveCount(0)
    await expect(page.getByTestId('change-password-refresh-retry')).toBeVisible()
    await page.screenshot({ path: evidence('01-troca-ok-refresh-falhou'), fullPage: true })

    // 2. The API comes back and the retry — of the `/me` only, never of the
    //    change — finishes the job and releases the home page.
    await page.unroute('**/me')
    await page.getByTestId('change-password-refresh-retry').click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('change-password-refresh-error')).toHaveCount(0)
    await expect(page.getByTestId('header-user-email')).toBeVisible()
    await page.screenshot({ path: evidence('02-retry-recuperado'), fullPage: true })
  })
})
