import { expect, type Page, test } from '@playwright/test'

import { seedParticipantToken } from './support/editor-fixture'
import { BACK_URL, E2E_PARTICIPANT_NAME } from './support/rounds'

// Repro + visual walkthrough for #179: `GET /me` fails while the session
// hydrates (a blip on the auditorium wifi, the back restarting) and the app
// used to strand the participant — the rejected promise was cached, so every
// later `ensureHydrated()` re-threw it and F5 was the only way out. The
// committed `00-antes-erro-do-router.png` is what that looked like before the
// fix: TanStack Router's bare error boundary, in English, with no header, no
// footer and no action.
// Prereqs (like auth.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// No organizer credentials and no round needed: the bug lives entirely in the
// front's session store, and a signed-up participant with a stored token is
// the whole setup.
const evidence = (name: string) => `e2e/evidence/179/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `session-hydration-e2e-${stamp}@edu.pucrs.br`

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

test.describe('session hydration failure (#179)', () => {
  let token = ''

  test.beforeAll(async () => {
    token = await apiSignupAndLogin()
  })

  async function signInThroughStoredToken(page: Page): Promise<void> {
    await seedParticipantToken(page, token)
  }

  test('offers a retry that recovers the guarded route without an F5', async ({ page }) => {
    await signInThroughStoredToken(page)
    // Every `/me` dies at the network layer — the same thing the browser sees
    // when the API is unreachable mid-hydration.
    await page.route('**/me', (route) => route.abort())

    await page.goto('/teams')

    // 1. Three silent attempts later, the failure is finally something the
    //    user can read and act on — and the shell around it still works.
    await expect(page.getByTestId('session-error-card')).toBeVisible()
    await expect(page.getByTestId('app-header')).toBeVisible()
    await expect(page.getByTestId('app-footer')).toBeVisible()
    await page.screenshot({ path: evidence('01-card-de-erro'), fullPage: true })

    // 2. The header says nothing about who this is: hydration never found
    //    out, so "Entrar/Cadastrar" would be a claim we cannot make.
    await expect(page.getByTestId('header-login-link')).toHaveCount(0)
    await expect(page.getByTestId('header-signup-link')).toHaveCount(0)
    await expect(page.getByTestId('header-user-email')).toHaveCount(0)
    await expect(page.getByTestId('header-home-link')).toBeVisible()
    await expect(page.getByTestId('language-selector')).toBeVisible()
    // The header alone: the full page is already 01, and what matters here is
    // the strip at the top, not the card below it.
    await page.getByTestId('app-header').screenshot({ path: evidence('02-header-neutro') })

    // 3. Retrying while the API is still down says so instead of pretending:
    //    the button reports itself and the card stays put.
    await page.getByTestId('session-error-retry').click()
    await expect(page.getByTestId('session-error-retry')).toBeDisabled()
    await expect(page.getByTestId('session-error-card')).toBeVisible()
    await page.screenshot({ path: evidence('03-retry-ainda-offline'), fullPage: true })
    await expect(page.getByTestId('session-error-retry')).toBeEnabled()

    // 4. The network comes back and the SAME retry button loads the route the
    //    user was heading to. No reload — that is the whole point of #179.
    await page.unroute('**/me')
    await page.getByTestId('session-error-retry').click()

    await expect(page.getByTestId('session-error-card')).toHaveCount(0)
    await expect(page.getByTestId('header-user-email')).toBeVisible()
    await expect(page).toHaveURL(/\/teams$/)
    await page.screenshot({ path: evidence('04-recuperado-sem-f5'), fullPage: true })
  })

  // The other half of the acceptance criteria: a `/me` that answers 401 is a
  // dead token, not a network problem. That one must NOT retry, and the user
  // must be told why they are back at the login screen.
  test('sends a genuinely expired token to /login with a visible notice', async ({ page }) => {
    await signInThroughStoredToken(page)
    await page.route('**/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized', message: 'token expired' }),
      }),
    )

    await page.goto('/teams')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('login-expired-notice')).toBeVisible()
    await expect(page.getByTestId('session-error-card')).toHaveCount(0)
    await page.screenshot({ path: evidence('05-sessao-expirada'), fullPage: true })
  })
})
