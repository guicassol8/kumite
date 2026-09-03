import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #40. Prereqs (like teams.spec.ts / organizer-problems.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD — the whole flow hinges on the
// organizer opening/closing a round via the API to prove the home screen
// updates live over SSE (#38), so the suite skips itself without them.
// Also needs no round already open in the shared dev db (a fresh
// `pnpm db:seed` never opens one) — apiOpenRound below would otherwise fail
// with another_round_open and every assertion after it would time out.
const evidence = (name: string) => `e2e/evidence/40/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `home-e2e-participant-${stamp}@edu.pucrs.br`
const roundName = `Rodada E2E ${stamp}`

test.describe('home (#40)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

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

  async function apiCreatePublishedProblem(): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: 'Soma', statementMd: 'Some dois números.' },
          { locale: 'es', title: 'Suma', statementMd: 'Suma dos números.' },
          { locale: 'en', title: 'Sum', statementMd: 'Sum two numbers.' },
        ],
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [2, 2], expected: 4, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  async function apiCreateRound(problemId: string): Promise<string> {
    const auth = await organizerAuthHeader()
    const res = await fetch(`${BACK_URL}/organizer/rounds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ name: roundName, durationMinutes: 30, problemIds: [problemId] }),
    })
    const { id } = (await res.json()) as { id: string }
    return id
  }

  async function apiOpenRound(roundId: string): Promise<void> {
    const auth = await organizerAuthHeader()
    await fetch(`${BACK_URL}/organizer/rounds/${roundId}/open`, { method: 'POST', headers: auth })
  }

  async function apiCloseRound(roundId: string): Promise<void> {
    const auth = await organizerAuthHeader()
    await fetch(`${BACK_URL}/organizer/rounds/${roundId}/close`, { method: 'POST', headers: auth })
  }

  async function signupThroughUi(page: Page, email: string): Promise<void> {
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(email)
  }

  test('reflects the event live: waiting, an open round, its close, and organizer shortcuts', async ({
    page,
    browser,
  }) => {
    // 01 — a fresh participant with no team, no open round: waiting copy + join CTA.
    await signupThroughUi(page, participantEmail)
    await expect(page.getByTestId('home-round-card')).toContainText('Aguardando a próxima rodada.')
    await expect(page.getByTestId('home-team-cta')).toBeVisible()
    await page.screenshot({ path: evidence('01-aguardando-sem-time'), fullPage: true })

    // 02 — the organizer opens a round via the API while this page stays open;
    // the SSE push (#38) must update the card without a reload (Acceptance #4).
    const problemId = await apiCreatePublishedProblem()
    const roundId = await apiCreateRound(problemId)
    await apiOpenRound(roundId)
    await expect(page.getByTestId('home-round-card')).toContainText(roundName, {
      timeout: 15_000,
    })
    await expect(page.getByTestId('round-countdown')).toBeVisible()
    await page.screenshot({ path: evidence('02-rodada-aberta-ao-vivo'), fullPage: true })

    // 03 — closing it live moves it into the closed-rounds list, no score shown.
    await apiCloseRound(roundId)
    await expect(page.getByTestId('home-round-card')).toContainText(
      'Aguardando a próxima rodada.',
      { timeout: 15_000 },
    )
    const closedCard = page.getByTestId('home-closed-rounds')
    await expect(closedCard).toContainText(roundName)
    await expect(closedCard).not.toContainText(/\d+\s*(pts|pontos|points)/i)
    await page.screenshot({ path: evidence('03-rodada-encerrada'), fullPage: true })

    // 04 — a separate organizer session sees the /organizer/problems shortcut.
    const organizerContext = await browser.newContext()
    const organizerPage = await organizerContext.newPage()
    await organizerPage.goto('/login')
    await organizerPage.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await organizerPage.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await organizerPage.getByTestId('login-submit-button').click()
    await expect(organizerPage.getByTestId('header-user-email')).toHaveText(ORGANIZER_EMAIL)
    await expect(organizerPage.getByTestId('home-organizer-shortcuts')).toBeVisible()
    await organizerPage.screenshot({ path: evidence('04-atalhos-organizador'), fullPage: true })
    await organizerContext.close()
  })
})
