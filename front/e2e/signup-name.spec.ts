import { expect, type Page, test } from '@playwright/test'
import { E2E_PARTICIPANT_NAME, ORGANIZER_NAME } from './support/rounds'

// Visual walkthrough for #122 (signup name + name search in the organizer
// panel + name on team rosters). Prereqs (like auth.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// The organizer-panel and team-moderation checks additionally need
// ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment and skip themselves
// when they are not set.
const evidence = (name: string) => `e2e/evidence/122/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
const stamp = Date.now()
const NAMED_EMAIL = `signup-name-e2e-${stamp}@edu.pucrs.br`

async function apiSignupAndLogin(email: string, name: string, code: string): Promise<string> {
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password: PASSWORD, code }),
  })
  const res = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const { token } = (await res.json()) as { token: string }
  return token
}

async function apiJoinTeam(token: string, teamId: string): Promise<void> {
  await fetch(`${BACK_URL}/teams/${teamId}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function apiMyTeamId(token: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/teams`, { headers: { Authorization: `Bearer ${token}` } })
  const { myTeamId } = (await res.json()) as { myTeamId: string | null }
  if (!myTeamId) throw new Error('expected the owner to have a team by now')
  return myTeamId
}

async function apiMyId(token: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
  const { id } = (await res.json()) as { id: string }
  return id
}

async function loginThroughUi(
  page: Page,
  email: string,
  password: string,
  expectedName: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(password)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(expectedName)
}

test('signup collects a name first, and the header shows it instead of the email', async ({
  page,
}) => {
  await page.goto('/signup')
  await page.getByTestId('signup-name-input').fill('Ada Lovelace')
  await page.getByTestId('signup-email-input').fill(NAMED_EMAIL)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill('PUCRS2026')
  await page.screenshot({ path: evidence('01-signup-name-first-field'), fullPage: true })

  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText('Ada Lovelace')
  await page.screenshot({ path: evidence('02-header-shows-name'), fullPage: true })
})

test('signup without a name is rejected inline', async ({ page }) => {
  await page.goto('/signup')
  await page.getByTestId('signup-email-input').fill(`signup-name-e2e-noname-${stamp}@edu.pucrs.br`)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill('PUCRS2026')

  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('signup-name-error')).toBeVisible()
  await page.screenshot({ path: evidence('03-signup-missing-name-error'), fullPage: true })
})

test.describe('organizer panel', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('users table has a Name column, and search matches by name too', async ({ page }) => {
    const targetEmail = `signup-name-e2e-target-${stamp}@edu.pucrs.br`
    const token = await apiSignupAndLogin(targetEmail, 'Grace Hopper', 'PUCRS2026')
    const targetId = await apiMyId(token)

    await loginThroughUi(page, ORGANIZER_EMAIL, ORGANIZER_PASSWORD, ORGANIZER_NAME)
    await page.goto('/organizer/users')
    await expect(page.getByTestId('organizer-users-table')).toBeVisible()
    await expect(page.getByTestId('organizer-users-table')).toContainText('Nome')
    await page.screenshot({ path: evidence('04-users-table-name-column'), fullPage: true })

    // "hopper" appears nowhere in the target's email — only the name side of
    // the OR search can produce this hit.
    await page.getByTestId('organizer-users-search-input').fill('hopper')
    await expect(page.getByTestId(`organizer-users-row-${targetId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-users-row-${targetId}`)).toContainText('Grace Hopper')
    await page.screenshot({ path: evidence('05-search-by-name'), fullPage: true })
  })
})

test('team roster shows the name for your own team, and email alone for others', async ({
  page,
  browser,
}) => {
  const ownerEmail = `signup-name-e2e-owner-${stamp}@edu.pucrs.br`
  const mateEmail = `signup-name-e2e-mate-${stamp}@edu.pucrs.br`
  const outsiderEmail = `signup-name-e2e-outsider-${stamp}@edu.pucrs.br`

  const ownerToken = await apiSignupAndLogin(ownerEmail, 'Alan Turing', 'PUCRS2026')
  const teamId = await (async () => {
    // Create the team through the UI once logged in, then hand off to the API
    // fixtures below for the second member.
    await loginThroughUi(page, ownerEmail, PASSWORD, 'Alan Turing')
    await page.getByTestId('header-teams-link').click()
    await page.getByTestId('teams-create-open').click()
    await page.getByTestId('teams-create-name-input').fill(`Name Evidence ${stamp}`)
    await page.getByTestId('teams-create-submit').click()
    await expect(page.getByTestId('my-team-panel')).toBeVisible()
    return apiMyTeamId(ownerToken)
  })()

  const mateToken = await apiSignupAndLogin(mateEmail, 'Barbara Liskov', 'PUCRS2026')
  await apiJoinTeam(mateToken, teamId)
  await page.reload()
  const panel = page.getByTestId('my-team-panel')
  await expect(panel).toContainText('Alan Turing')
  await expect(panel).toContainText('Barbara Liskov')
  await page.screenshot({ path: evidence('06-own-team-shows-names'), fullPage: true })

  // A different context (own login) sees the same team anonymized: no name,
  // no email — only the university badge, same as before #122.
  const outsiderContext = await browser.newContext()
  const outsiderPage = await outsiderContext.newPage()
  await apiSignupAndLogin(outsiderEmail, 'Edsger Dijkstra', 'PUCRS2026')
  await loginThroughUi(outsiderPage, outsiderEmail, PASSWORD, 'Edsger Dijkstra')
  await outsiderPage.getByTestId('header-teams-link').click()
  const row = outsiderPage.getByTestId(`teams-row-${teamId}`)
  await expect(row).toBeVisible()
  await expect(row).not.toContainText('Alan Turing')
  await expect(row).not.toContainText(ownerEmail)
  await outsiderPage.screenshot({ path: evidence('07-other-team-anonymized'), fullPage: true })
  await outsiderContext.close()
})
