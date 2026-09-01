import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #33. Prereqs (like auth.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// The 01 screenshot needs an empty `teams` table — this suite does not
// truncate it itself, since the dev DB is shared across worktrees. Reset with:
//   psql ... -c 'truncate table team_members, teams restart identity cascade'
// The organizer read-only test additionally needs ORGANIZER_EMAIL /
// ORGANIZER_PASSWORD (the same pair `pnpm db:seed` consumes) and skips itself
// when they are not set.
const evidence = (name: string) => `e2e/evidence/33/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const TEAM_NAME = 'Blockly Busters'
const PASSWORD = 'supersecret'

const stamp = Date.now()
const emails = {
  owner: `teams-e2e-owner-${stamp}@edu.pucrs.br`,
  mate: `teams-e2e-mate-${stamp}@merida.edu.mx`,
  filler: `teams-e2e-filler-${stamp}@edu.pucrs.br`,
  outsider: `teams-e2e-outsider-${stamp}@edu.pucrs.br`,
}

// Teammates only need to *exist* on the team for the screenshots; driving
// three more browsers through signup would add nothing to the evidence.
async function apiSignupAndLogin(email: string, code: string): Promise<string> {
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, code }),
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

async function signupThroughUi(page: Page, email: string, code: string): Promise<void> {
  await page.goto('/signup')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill(code)
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(email)
}

async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(password)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(email)
}

test('walks a participant through creating, filling, and leaving a team', async ({ page }) => {
  // 01 — a participant with no teams anywhere sees the empty state.
  await signupThroughUi(page, emails.owner, 'PUCRS2026')
  await page.getByTestId('header-teams-link').click()
  await expect(page.getByTestId('teams-empty')).toBeVisible()
  await page.screenshot({ path: evidence('01-lista-vazia'), fullPage: true })

  // 02 — the create dialog, filled in.
  await page.getByTestId('teams-empty-cta').click()
  await expect(page.getByTestId('teams-create-dialog')).toBeVisible()
  await page.getByTestId('teams-create-name-input').fill(TEAM_NAME)
  await page.screenshot({ path: evidence('02-dialog-criar'), fullPage: true })

  await page.getByTestId('teams-create-submit').click()
  await expect(page.getByTestId('my-team-panel')).toBeVisible()

  // 03 — the panel with a real teammate: two universities, both emails.
  const ownerToken = await apiSignupAndLogin(emails.owner, 'PUCRS2026')
  const teamId = await apiMyTeamId(ownerToken)
  const mateToken = await apiSignupAndLogin(emails.mate, 'MERIDA2026')
  await apiJoinTeam(mateToken, teamId)
  await page.reload()
  // The roster comes back in whatever order the join produced, so assert on
  // the panel as a whole rather than on a member's position.
  const panel = page.getByTestId('my-team-panel')
  await expect(panel).toContainText(emails.mate)
  await expect(panel).toContainText(emails.owner)
  await expect(panel).toContainText('Mérida')
  await page.screenshot({ path: evidence('03-meu-time-com-membro'), fullPage: true })

  // Fill the last slot (3/3 by default) so the outsider below hits team_full.
  const fillerToken = await apiSignupAndLogin(emails.filler, 'PUCRS2026')
  await apiJoinTeam(fillerToken, teamId)

  // 04 — a second participant reusing the name gets it on the name field.
  await page.getByTestId('header-logout-button').click()
  await signupThroughUi(page, emails.outsider, 'PUCRS2026')
  await page.getByTestId('header-teams-link').click()
  await page.getByTestId('teams-create-open').click()
  await page.getByTestId('teams-create-name-input').fill(TEAM_NAME.toLowerCase())
  await page.getByTestId('teams-create-submit').click()
  await expect(page.getByTestId('teams-create-name-error')).toBeVisible()
  await page.screenshot({ path: evidence('04-nome-duplicado'), fullPage: true })

  // 05 — and Join on the now-full team is disabled, with the reason next to it.
  await page.getByTestId('teams-create-cancel').click()
  const row = page.getByTestId(`teams-row-${teamId}`)
  await expect(row).toContainText('0/3')
  await expect(page.getByTestId(`teams-join-${teamId}`)).toBeDisabled()
  await expect(row).toContainText('Time cheio')
  await page.screenshot({ path: evidence('05-time-cheio-entrar-desabilitado'), fullPage: true })

  // 06 — back as the owner, leaving asks for confirmation first.
  await page.getByTestId('header-logout-button').click()
  await loginThroughUi(page, emails.owner, PASSWORD)
  await page.getByTestId('header-teams-link').click()
  await expect(page.getByTestId('my-team-leave')).toBeEnabled()
  await page.getByTestId('my-team-leave').click()
  await expect(page.getByTestId('teams-leave-dialog')).toBeVisible()
  await page.screenshot({ path: evidence('06-dialog-sair'), fullPage: true })

  await page.getByTestId('teams-leave-confirm').click()
  await expect(page.getByTestId('my-team-panel')).toBeHidden()

  // 07 — the frozen state. No route writes `firstSubmittedAt` yet (it is
  // owned by the submissions epic), so this is the one step the real API
  // cannot reach: the listing response is stubbed with frozen: true.
  const listUrl = `${BACK_URL}/teams`
  await page.route(listUrl, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        maxTeamSize: 3,
        mixingLocked: false,
        myTeamId: teamId,
        teams: [
          {
            id: teamId,
            name: TEAM_NAME,
            members: [
              { university: 'pucrs', email: emails.owner },
              { university: 'merida', email: emails.mate },
            ],
            slotsAvailable: 1,
            frozen: true,
            joinBlockedReason: 'already_in_team',
          },
        ],
      }),
    })
  })
  await page.reload()
  await expect(page.getByTestId('my-team-frozen-notice')).toBeVisible()
  await expect(page.getByTestId('my-team-leave')).toBeDisabled()
  await page.screenshot({ path: evidence('07-time-congelado'), fullPage: true })
  await page.unroute(listUrl)
})

test.describe('organizer', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('sees the listing without any team action', async ({ page }) => {
    await loginThroughUi(page, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
    await page.getByTestId('header-teams-link').click()

    // 08 — read-only: the table is there, Criar time and Entrar are not.
    await expect(page.getByTestId('teams-table')).toBeVisible()
    await expect(page.getByTestId('teams-create-open')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0)
    await page.screenshot({ path: evidence('08-organizador-somente-leitura'), fullPage: true })
  })
})
