import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #51. Prereqs (like teams.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment and skips
// itself when they are not set.
const evidence = (name: string) => `e2e/evidence/51/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
// Short but unique enough for a single evidence run — long e2e emails made
// the moderation table's action column overflow its card in the screenshots.
const stamp = Date.now().toString().slice(-6)
const emails = {
  creatorA: `e2e-a-${stamp}@edu.pucrs.br`,
  mateA: `e2e-mate-${stamp}@merida.edu.mx`,
  creatorDest: `e2e-dest-${stamp}@edu.pucrs.br`,
}
// A fresh participant per full-team slot — how many depends on maxTeamSize
// (event_config), read from the API rather than hardcoded.
const fullTeamEmail = (n: number) => `e2e-full${n}-${stamp}@edu.pucrs.br`
// Team names must be unique event-wide, and the dev DB is shared across
// worktrees/specs (same reasoning as teams.spec.ts) — the stamp keeps every
// rerun collision-free.
const teamNames = {
  a: `Blockly Busters ${stamp}`,
  aRenamed: `Rebranded Squad ${stamp}`,
  full: `Full Squad ${stamp}`,
  dest: `Open Landing ${stamp}`,
}

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

async function apiCreateTeam(token: string, name: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/teams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })
  const { id } = (await res.json()) as { id: string }
  return id
}

async function apiJoinTeam(token: string, teamId: string): Promise<void> {
  await fetch(`${BACK_URL}/teams/${teamId}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function apiMyId(token: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
  const { id } = (await res.json()) as { id: string }
  return id
}

async function apiMaxTeamSize(token: string): Promise<number> {
  const res = await fetch(`${BACK_URL}/teams`, { headers: { Authorization: `Bearer ${token}` } })
  const { maxTeamSize } = (await res.json()) as { maxTeamSize: number }
  return maxTeamSize
}

async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(password)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(email)
}

test.describe('organizer team moderation', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('walks through rename, move, remove member, and remove team', async ({ page }) => {
    // Eight full-page screenshots in one walkthrough: 14s to 31s across five
    // runs of the full suite, against a 30s default. It was not stuck — it was
    // simply out of budget, and died on whichever screenshot it had reached,
    // making two consecutive suite runs disagree (#150 review).
    test.slow()

    // Fixtures via the real API — same reasoning as teams.spec.ts: these
    // teammates only need to exist, driving five more browsers through
    // signup would add nothing to the evidence.
    const creatorAToken = await apiSignupAndLogin(emails.creatorA, 'PUCRS2026')
    const mateAToken = await apiSignupAndLogin(emails.mateA, 'MERIDA2026')
    const teamAId = await apiCreateTeam(creatorAToken, teamNames.a)
    await apiJoinTeam(mateAToken, teamAId)
    const mateAId = await apiMyId(mateAToken)

    const maxTeamSize = await apiMaxTeamSize(creatorAToken)
    const [creatorFullToken, ...memberFullTokens] = await Promise.all(
      Array.from({ length: maxTeamSize }, (_, i) =>
        apiSignupAndLogin(fullTeamEmail(i + 1), 'PUCRS2026'),
      ),
    )
    if (!creatorFullToken) throw new Error('expected at least one full-team fixture user')
    const teamFullId = await apiCreateTeam(creatorFullToken, teamNames.full)
    for (const token of memberFullTokens) await apiJoinTeam(token, teamFullId)

    const creatorDestToken = await apiSignupAndLogin(emails.creatorDest, 'PUCRS2026')
    const teamDestId = await apiCreateTeam(creatorDestToken, teamNames.dest)

    await loginThroughUi(page, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)

    // 01 — initial state: 3 teams, "Full Squad" stubbed as frozen (no route
    // marks firstSubmittedAt yet — same gap teams.spec.ts hits for the
    // participant view) — and every action still exposed despite the badge.
    const listUrl = `${BACK_URL}/organizer/teams`
    await page.route(listUrl, async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const response = await route.fetch()
      const json = (await response.json()) as { teams: { id: string; frozen: boolean }[] }
      const target = json.teams.find((team) => team.id === teamFullId)
      if (target) target.frozen = true
      await route.fulfill({ response, json })
    })
    await page.goto('/organizer/teams')
    await expect(page.getByTestId(`team-moderation-card-${teamAId}`)).toBeVisible()
    await expect(page.getByTestId(`team-moderation-card-${teamFullId}`)).toBeVisible()
    await expect(page.getByTestId(`team-moderation-card-${teamDestId}`)).toBeVisible()
    await expect(page.getByTestId(`team-moderation-frozen-${teamFullId}`)).toBeVisible()
    await expect(page.getByTestId(`team-moderation-remove-team-action-${teamFullId}`)).toBeEnabled()
    await expect(page.getByTestId(`team-moderation-rename-start-${teamFullId}`)).toBeEnabled()
    await page.screenshot({ path: evidence('01-initial-state'), fullPage: true })
    await page.unroute(listUrl)

    // 02 — inline rename of "Blockly Busters".
    await page.reload()
    await page.getByTestId(`team-moderation-rename-start-${teamAId}`).click()
    await page.getByTestId(`team-moderation-rename-input-${teamAId}`).fill(teamNames.aRenamed)
    await page.getByTestId(`team-moderation-rename-save-${teamAId}`).click()
    await expect(page.getByTestId(`team-moderation-name-${teamAId}`)).toContainText(
      teamNames.aRenamed,
    )
    await page.screenshot({ path: evidence('02-rename-salvo'), fullPage: true })

    // 03 — move mateA out of the renamed team: the full team shows up
    // disabled in the destination dropdown. Radix closes the popover on any
    // ancestor scroll, so this one screenshot stays viewport-only (no
    // fullPage) instead of scrolling the whole page to stitch it.
    const moveSelect = page.getByTestId(`team-moderation-move-select-${mateAId}`)
    await moveSelect.scrollIntoViewIfNeeded()
    await moveSelect.click()
    await expect(page.getByRole('option', { name: teamNames.full })).toBeDisabled()
    await page.screenshot({ path: evidence('03-select-destino-cheio-desabilitado') })

    await page.getByRole('option', { name: teamNames.dest }).click()
    await page.getByTestId(`team-moderation-move-action-${mateAId}`).click()
    await expect(
      page
        .getByTestId(`team-moderation-card-${teamAId}`)
        .getByTestId(`team-moderation-member-row-${mateAId}`),
    ).not.toBeVisible()
    await expect(
      page
        .getByTestId(`team-moderation-card-${teamDestId}`)
        .getByTestId(`team-moderation-member-row-${mateAId}`),
    ).toBeVisible()
    await page.screenshot({ path: evidence('04-membro-movido'), fullPage: true })

    // 05 — remove that member from "Open Landing", with the confirmation
    // dialog explaining the consequence.
    await page.getByTestId(`team-moderation-remove-member-action-${mateAId}`).click()
    await expect(page.getByTestId(`team-moderation-remove-member-confirm-${mateAId}`)).toBeVisible()
    await page.screenshot({ path: evidence('05-dialog-remover-membro'), fullPage: true })

    await page.getByTestId(`team-moderation-remove-member-confirm-confirm-${mateAId}`).click()
    await expect(page.getByTestId(`team-moderation-member-row-${mateAId}`)).not.toBeVisible()
    await page.screenshot({ path: evidence('06-membro-removido'), fullPage: true })

    // 07 — remove the renamed team entirely, with the confirmation dialog
    // explaining the consequence.
    await page.getByTestId(`team-moderation-remove-team-action-${teamAId}`).click()
    await expect(page.getByTestId(`team-moderation-remove-team-confirm-${teamAId}`)).toBeVisible()
    await page.screenshot({ path: evidence('07-dialog-remover-time'), fullPage: true })

    await page.getByTestId(`team-moderation-remove-team-confirm-confirm-${teamAId}`).click()
    await expect(page.getByTestId(`team-moderation-card-${teamAId}`)).not.toBeVisible()
    await page.screenshot({ path: evidence('08-time-removido'), fullPage: true })
  })
})
