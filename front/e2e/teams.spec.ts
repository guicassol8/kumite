import { expect, type Page, test } from '@playwright/test'
import { E2E_PARTICIPANT_NAME, ORGANIZER_NAME } from './support/rounds'

// Visual walkthrough for #33. Prereqs (like auth.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// The 01 screenshot used to need a genuinely empty `teams` table, which is true
// exactly once per database — every later run tripped over this suite's own
// team. It is stubbed now, and the team name carries a stamp so a second run
// does not collide with the first (#150).
// The organizer read-only test additionally needs ORGANIZER_EMAIL /
// ORGANIZER_PASSWORD (the same pair `pnpm db:seed` consumes) and skips itself
// when they are not set.
const evidence = (name: string) => `e2e/evidence/33/${name}.png`
// #185 rides along in this walkthrough because its two refusals are the same
// create dialog as step 04, one keystroke apart — but its evidence belongs to
// its own issue folder.
const evidence185 = (name: string) => `e2e/evidence/185/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'

const stamp = Date.now()
const TEAM_NAME = `Blockly Busters ${stamp}`
const emails = {
  owner: `teams-e2e-owner-${stamp}@edu.pucrs.br`,
  mate: `teams-e2e-mate-${stamp}@merida.edu.mx`,
  filler: (index: number) => `teams-e2e-filler-${index}-${stamp}@edu.pucrs.br`,
  outsider: `teams-e2e-outsider-${stamp}@edu.pucrs.br`,
}

// Teammates only need to *exist* on the team for the screenshots; driving
// three more browsers through signup would add nothing to the evidence.
async function apiSignupAndLogin(email: string, code: string): Promise<string> {
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Participante', email, password: PASSWORD, code }),
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

/**
 * `maxTeamSize` is event-wide, mutable config (`organizer-event-config.spec.ts`
 * writes it), so its value is whatever the last run left behind — not the
 * schema default of 3. Step 05 needs a genuinely full team, so it reads the
 * ceiling instead of assuming one (#150).
 */
async function apiMaxTeamSize(token: string): Promise<number> {
  const res = await fetch(`${BACK_URL}/teams`, { headers: { Authorization: `Bearer ${token}` } })
  const { maxTeamSize } = (await res.json()) as { maxTeamSize: number }
  return maxTeamSize
}

async function signupThroughUi(page: Page, email: string, code: string): Promise<void> {
  await page.goto('/signup')
  await page.getByTestId('signup-name-input').fill('E2E Participante')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill(code)
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
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

test('walks a participant through creating, filling, and leaving a team', async ({ page }) => {
  // 01 — a participant with no teams anywhere sees the empty state. Stubbed:
  // the real table is only empty on a database no run has touched yet. Scoped
  // to the back's origin, same as the frozen-state stub in step 07.
  const listApiUrl = `${BACK_URL}/teams`
  await page.route(listApiUrl, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ maxTeamSize: 3, mixingLocked: false, myTeamId: null, teams: [] }),
      })
    } else {
      route.continue()
    }
  })
  await signupThroughUi(page, emails.owner, 'PUCRS2026')
  await page.getByTestId('header-teams-link').click()
  await expect(page.getByTestId('teams-empty')).toBeVisible()
  await page.screenshot({ path: evidence('01-lista-vazia'), fullPage: true })

  // 02 — the create dialog, filled in.
  await page.getByTestId('teams-empty-cta').click()
  await expect(page.getByTestId('teams-create-dialog')).toBeVisible()
  await page.getByTestId('teams-create-name-input').fill(TEAM_NAME)
  await page.screenshot({ path: evidence('02-dialog-criar'), fullPage: true })

  await page.unroute(listApiUrl)
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

  // Fill every remaining slot so the outsider below hits team_full. The owner
  // and the mate already hold two of them.
  const maxTeamSize = await apiMaxTeamSize(ownerToken)
  for (let filler = 0; filler < maxTeamSize - 2; filler++) {
    const fillerToken = await apiSignupAndLogin(emails.filler(filler), 'PUCRS2026')
    await apiJoinTeam(fillerToken, teamId)
  }

  // 04 — a second participant reusing the name gets it on the name field.
  await page.getByTestId('header-logout-button').click()
  await signupThroughUi(page, emails.outsider, 'PUCRS2026')
  await page.getByTestId('header-teams-link').click()
  await page.getByTestId('teams-create-open').click()
  await page.getByTestId('teams-create-name-input').fill(TEAM_NAME.toLowerCase())
  await page.getByTestId('teams-create-submit').click()
  await expect(page.getByTestId('teams-create-name-error')).toBeVisible()
  await page.screenshot({ path: evidence('04-nome-duplicado'), fullPage: true })

  // 04b (#185, achado #11) — the same name with a trailing space is the same
  // name: the index folds case but not whitespace, so this only fails because
  // the name is normalized before it is stored.
  await page.getByTestId('teams-create-name-input').fill(`${TEAM_NAME} `)
  await page.getByTestId('teams-create-submit').click()
  await expect(page.getByTestId('teams-create-name-error')).toBeVisible()
  await expect(page.getByTestId('teams-create-name-error')).toContainText(
    'Já existe um time com esse nome',
  )
  await page.screenshot({ path: evidence185('01-duplicado-por-espaco'), fullPage: true })

  // 04c (#185, achado #10) — a name of nothing but spaces is refused on the
  // field, and no nameless team is created.
  await page.getByTestId('teams-create-name-input').fill('   ')
  await page.getByTestId('teams-create-submit').click()
  await expect(page.getByTestId('teams-create-name-error')).toContainText('Informe o nome do time')
  await expect(page.getByTestId('teams-create-form-error')).toBeHidden()
  await page.screenshot({ path: evidence185('02-nome-em-branco'), fullPage: true })

  // 05 — and Join on the now-full team is disabled, with the reason next to it.
  await page.getByTestId('teams-create-cancel').click()
  // Neither refusal above created anything: the outsider is still teamless, so
  // the create action is still on offer and there is no team panel.
  await expect(page.getByTestId('teams-create-open')).toBeVisible()
  await expect(page.getByTestId('my-team-panel')).toBeHidden()
  const row = page.getByTestId(`teams-row-${teamId}`)
  await expect(row).toContainText(`0/${maxTeamSize}`)
  await expect(page.getByTestId(`teams-join-${teamId}`)).toBeDisabled()
  await expect(row).toContainText('Time cheio')
  await page.screenshot({ path: evidence('05-time-cheio-entrar-desabilitado'), fullPage: true })

  // 06 — back as the owner, leaving asks for confirmation first.
  await page.getByTestId('header-logout-button').click()
  await loginThroughUi(page, emails.owner, PASSWORD, E2E_PARTICIPANT_NAME)
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
        maxTeamSize,
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
    await loginThroughUi(page, ORGANIZER_EMAIL, ORGANIZER_PASSWORD, ORGANIZER_NAME)
    await page.getByTestId('header-teams-link').click()

    // 08 — read-only: the table is there, Criar time and Entrar are not.
    await expect(page.getByTestId('teams-table')).toBeVisible()
    await expect(page.getByTestId('teams-create-open')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0)
    await page.screenshot({ path: evidence('08-organizador-somente-leitura'), fullPage: true })
  })
})
