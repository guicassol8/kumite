import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #54. Prereqs (like organizer-rounds.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment.
const evidence = (name: string) => `e2e/evidence/54/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`

test.describe('organizer overview', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_EMAIL)
  }

  let organizerToken: string | undefined
  async function organizerAuthHeader(): Promise<Record<string, string>> {
    if (!organizerToken) {
      const res = await fetch(`${BACK_URL}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
      })
      const { token } = (await res.json()) as { token: string }
      organizerToken = token
    }
    return { authorization: `Bearer ${organizerToken}` }
  }

  async function seedPublishedProblem(title: string): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy', points: 10 }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [4, 5], expected: 9, hidden: true },
        ],
        translations: [
          { locale: 'pt', title, statementMd: `Resolva ${title}.` },
          { locale: 'es', title, statementMd: `Resuelve ${title}.` },
          { locale: 'en', title, statementMd: `Solve ${title}.` },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  async function seedRound(name: string, problemId: string): Promise<string> {
    const auth = await organizerAuthHeader()
    const res = await fetch(`${BACK_URL}/organizer/rounds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ name, durationMinutes: 20, problemIds: [problemId] }),
    })
    const { id } = (await res.json()) as { id: string }
    return id
  }

  async function openRound(id: string) {
    await fetch(`${BACK_URL}/organizer/rounds/${id}/open`, {
      method: 'POST',
      headers: await organizerAuthHeader(),
    })
  }

  async function closeRound(id: string) {
    await fetch(`${BACK_URL}/organizer/rounds/${id}/close`, {
      method: 'POST',
      headers: await organizerAuthHeader(),
    })
  }

  test('shows the event numbers, the live round and the last closed round', async ({ page }) => {
    await loginAsOrganizer(page)
    const problemId = await seedPublishedProblem('Soma de dois números')

    // 01 — the overview is the panel index: the three counter cards plus
    // "Visão geral" active in the nav (Acceptance #1).
    await page.goto('/organizer')
    await expect(page.getByTestId('overview-heading')).toBeVisible()
    await expect(page.getByTestId('overview-signups-total')).toBeVisible()
    await expect(page.getByTestId('overview-teams-card')).toBeVisible()
    await expect(page.getByTestId('overview-submissions-card')).toBeVisible()
    await page.screenshot({ path: evidence('01-overview-numbers'), fullPage: true })

    // 02 — with no round announced yet, the round card says so.
    await expect(page.getByTestId('overview-round-none')).toBeVisible()
    await page.screenshot({ path: evidence('02-round-card-empty'), fullPage: true })

    // 03 — an open round: the card names it and runs the countdown, pushed
    // live over /sse without a reload (Acceptance #2).
    const roundId = await seedRound('Rodada Overview', problemId)
    await openRound(roundId)
    await expect(page.getByTestId('overview-round-name')).toContainText('Rodada Overview')
    await expect(page.getByTestId('round-countdown')).toBeVisible()
    await page.screenshot({ path: evidence('03-round-open-timer'), fullPage: true })

    // 04 — the submissions card labels its count as this round's while the
    // round is open.
    await expect(page.getByTestId('overview-submissions-in-round')).toContainText('nesta rodada')
    await page.screenshot({ path: evidence('04-submissions-in-round'), fullPage: true })

    // 05 — once closed, the card falls back to the last closed round with
    // its podium (empty here: no team scored in it) (Acceptance #3).
    await closeRound(roundId)
    await expect(page.getByTestId('overview-round-name')).toContainText('Rodada Overview')
    await expect(page.getByTestId('overview-round-closed-at')).toBeVisible()
    await expect(page.getByTestId('overview-round-podium')).toBeVisible()
    await page.screenshot({ path: evidence('05-last-closed-round'), fullPage: true })

    // 06 — the shortcuts card reaches the other panel screens.
    await page.getByTestId('overview-shortcuts-rounds').click()
    await expect(page).toHaveURL(/\/organizer\/rounds$/)
    await page.screenshot({ path: evidence('06-shortcut-to-rounds'), fullPage: true })
  })
})
