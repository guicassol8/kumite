import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #53. Prereqs (like organizer-team-moderation.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment and skips
// itself when they are not set.
const evidence = (name: string) => `e2e/evidence/53/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
// The dev DB is shared across worktrees and reruns (same reasoning as
// teams.spec.ts) — the stamp keeps every run's fixtures collision-free.
const stamp = Date.now().toString().slice(-6)
const emails = {
  pucrs: `e2e-u-${stamp}@edu.pucrs.br`,
  merida: `e2e-m-${stamp}@merida.edu.mx`,
}

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
    body: JSON.stringify({ email, password: PASSWORD, code }),
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
  await expect(page.getByTestId('header-user-email')).toHaveText(email)
}

test.describe('organizer user administration', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('walks through filtering, search, promoting and deactivating', async ({ page }) => {
    // Fixtures via the real API — these accounts only need to exist for the
    // listing to have something to act on.
    const pucrsToken = await apiSignupAndLogin(emails.pucrs, 'PUCRS2026')
    const meridaToken = await apiSignupAndLogin(emails.merida, 'MERIDA2026')
    const pucrsId = await apiMyId(pucrsToken)
    const meridaId = await apiMyId(meridaToken)
    const organizerId = await apiMyId(await apiLogin(ORGANIZER_EMAIL, ORGANIZER_PASSWORD))

    await loginThroughUi(page, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)

    // The screen is reachable from the Panel — both entry points #54 left
    // pending are closed by this issue.
    await page.goto('/organizer')
    await expect(page.getByTestId('organizer-nav-users')).toBeVisible()
    await expect(page.getByTestId('overview-shortcuts-users')).toBeVisible()
    await page.screenshot({ path: evidence('00-panel-entry-points'), fullPage: true })
    await page.getByTestId('overview-shortcuts-users').click()
    await expect(page.getByTestId('organizer-users-heading')).toBeVisible()
    await expect(page.getByTestId('organizer-users-table')).toBeVisible()
    // How many pages exist depends on the seeded volume, so the walkthrough
    // shows the pager rather than asserting a particular page count.
    await expect(page.getByTestId('organizer-users-range')).toBeVisible()
    await expect(page.getByTestId('organizer-users-prev')).toBeDisabled()
    await page.screenshot({ path: evidence('01-users-listing'), fullPage: true })

    // Search narrows to a single account.
    await page.getByTestId('organizer-users-search-input').fill(emails.merida)
    await expect(page.getByTestId(`organizer-users-row-${meridaId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-users-row-${pucrsId}`)).toHaveCount(0)
    await page.screenshot({ path: evidence('02-search-by-email'), fullPage: true })

    // Filtering by university keeps Mérida and drops the PUCRS fixture.
    await page.getByTestId('organizer-users-search-input').fill('')
    await page.getByTestId('organizer-users-filter-university').click()
    await page.getByRole('option', { name: 'Mérida' }).click()
    await expect(page.getByTestId(`organizer-users-row-${meridaId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-users-row-${pucrsId}`)).toHaveCount(0)
    await page.screenshot({ path: evidence('03-filter-by-university'), fullPage: true })

    // Back to everyone, then narrow to the PUCRS fixture to act on it.
    await page.getByTestId('organizer-users-filter-university').click()
    await page.getByRole('option', { name: 'Todos' }).click()
    await page.getByTestId('organizer-users-search-input').fill(emails.pucrs)
    await expect(page.getByTestId(`organizer-users-row-${pucrsId}`)).toBeVisible()

    // Promoting is one click — no confirmation for a reversible change.
    await page.getByTestId(`organizer-users-promote-${pucrsId}`).click()
    await expect(page.getByTestId(`organizer-users-demote-${pucrsId}`)).toBeVisible()
    await page.screenshot({ path: evidence('04-promoted-to-organizer'), fullPage: true })

    // Deactivating asks first.
    await page.getByTestId(`organizer-users-deactivate-${pucrsId}`).click()
    await expect(page.getByTestId(`organizer-users-confirm-${pucrsId}`)).toBeVisible()
    await page.screenshot({ path: evidence('05-deactivate-confirmation'), fullPage: true })
    await page.getByTestId(`organizer-users-confirm-confirm-${pucrsId}`).click()

    await expect(page.getByTestId(`organizer-users-status-${pucrsId}`)).toHaveText('Desativado')
    await expect(page.getByTestId(`organizer-users-reactivate-${pucrsId}`)).toBeVisible()
    await page.screenshot({ path: evidence('06-deactivated-row'), fullPage: true })

    // The organizer's own row refuses every action, with the reason attached.
    await page.getByTestId('organizer-users-search-input').fill(ORGANIZER_EMAIL)
    await expect(page.getByTestId(`organizer-users-row-${organizerId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-users-self-tooltip-${organizerId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-users-demote-${organizerId}`)).toBeDisabled()
    await expect(page.getByTestId(`organizer-users-deactivate-${organizerId}`)).toBeDisabled()
    // Acceptance asks for the explanation, not just the greyed buttons — hover
    // the wrapper (disabled buttons swallow pointer events) to surface it.
    await page.getByTestId(`organizer-users-self-tooltip-${organizerId}`).hover()
    await expect(page.getByRole('tooltip').first()).toHaveText(
      'Você não pode alterar a sua própria conta.',
    )
    await page.screenshot({ path: evidence('07-own-row-disabled'), fullPage: true })
  })
})
