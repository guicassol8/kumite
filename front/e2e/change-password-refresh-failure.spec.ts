import { expect, test } from '@playwright/test'

import { seedParticipantToken } from './support/editor-fixture'
import {
  BACK_URL,
  E2E_PARTICIPANT_NAME,
  hasOrganizerCredentials,
  organizerAuthHeader,
} from './support/rounds'

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

async function apiSignupAndLogin(email = participantEmail): Promise<string> {
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: E2E_PARTICIPANT_NAME,
      email,
      password: PASSWORD,
      code: 'PUCRS2026',
    }),
  })
  const res = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const { token } = (await res.json()) as { token: string }
  return token
}

async function apiMyId(token: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
  const { id } = (await res.json()) as { id: string }
  return id
}

// The only way to flag an account: the on-site reset of #143. Done through the
// API rather than the organizer UI, which `organizer-reset-password.spec.ts`
// already walks — here it is a fixture, not the thing under test.
async function apiOrganizerReset(userId: string): Promise<string> {
  const auth = await organizerAuthHeader()
  const res = await fetch(`${BACK_URL}/organizer/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ adminPassword: process.env.ORGANIZER_PASSWORD }),
  })
  const { temporaryPassword } = (await res.json()) as { temporaryPassword: string }
  return temporaryPassword
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

// AC3 of #190, in the browser: a flagged account that clicks somewhere else is
// bounced back here by `requireAuth`, and the screen now says why instead of
// silently swapping the page under the user. Needs the organizer credentials
// because flagging an account is an organizer-only action.
test.describe('change-password bounce notice (#190)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('explains why a guard sent the user back', async ({ page }) => {
    const bouncedEmail = `change-password-bounce-e2e-${stamp}@edu.pucrs.br`
    const token = await apiSignupAndLogin(bouncedEmail)
    const temporaryPassword = await apiOrganizerReset(await apiMyId(token))

    // Signing in with the temporary password lands on the change screen by way
    // of login.tsx, which carries no notice — the generic copy is the right one
    // there, since nothing was taken away from the user.
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(bouncedEmail)
    await page.getByTestId('login-password-input').fill(temporaryPassword)
    await page.getByTestId('login-submit-button').click()
    await expect(page).toHaveURL(/\/change-password$/)
    await expect(page.getByTestId('change-password-required-notice')).toBeVisible()
    await expect(page.getByTestId('change-password-bounced-notice')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-chegada-pelo-login'), fullPage: true })

    // Asking for another screen is where the bounce happens — and this is what
    // used to be silent.
    await page.goto('/teams')
    await expect(page).toHaveURL(/\/change-password\?notice=required$/)
    await expect(page.getByTestId('change-password-bounced-notice')).toBeVisible()
    await expect(page.getByTestId('change-password-required-notice')).toHaveCount(0)
    await page.screenshot({ path: evidence('04-bounce-com-motivo'), fullPage: true })
  })
})
