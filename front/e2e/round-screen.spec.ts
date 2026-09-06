import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #39. Prereqs (like home.spec.ts / teams.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD — the flow hinges on the
// organizer opening/closing a round via the API to prove the round screen
// updates live over SSE. Also needs no round already open in the shared dev
// db, same caveat as home.spec.ts.
const evidence = (name: string) => `e2e/evidence/39/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `round-screen-e2e-participant-${stamp}@edu.pucrs.br`
const roundName = `Rodada Detalhe E2E ${stamp}`

test.describe('round screen (#39)', () => {
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

  async function apiCreatePublishedProblem(
    difficulty: 'easy' | 'medium',
    titles: { pt: string; es: string; en: string },
  ): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: titles.pt, statementMd: 'Enunciado.' },
          { locale: 'es', title: titles.es, statementMd: 'Enunciado.' },
          { locale: 'en', title: titles.en, statementMd: 'Statement.' },
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

  async function apiCreateRound(problemIds: string[]): Promise<string> {
    const auth = await organizerAuthHeader()
    const res = await fetch(`${BACK_URL}/organizer/rounds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ name: roundName, durationMinutes: 30, problemIds }),
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

  test('shows the problems table live, then flips to the closed read-only state without a stale notice on reload', async ({
    page,
  }) => {
    const problemAId = await apiCreatePublishedProblem('easy', {
      pt: 'Soma',
      es: 'Suma',
      en: 'Sum',
    })
    const problemBId = await apiCreatePublishedProblem('medium', {
      pt: 'Produto',
      es: 'Producto',
      en: 'Product',
    })
    const roundId = await apiCreateRound([problemAId, problemBId])

    // 01 — sign up, then open the round live while the home screen is up.
    await signupThroughUi(page, participantEmail)
    await apiOpenRound(roundId)
    await expect(page.getByTestId('home-round-card')).toContainText(roundName, {
      timeout: 15_000,
    })
    await page.getByTestId('home-round-cta').click()
    await expect(page).toHaveURL(new RegExp(`/rounds/${roundId}$`))
    await page.screenshot({ path: evidence('01-rodada-aberta'), fullPage: true })

    // 02 — both problems show title/difficulty/points, no score yet (dash),
    // and the live countdown is visible.
    const rowA = page.getByTestId(`round-problem-${problemAId}`)
    const rowB = page.getByTestId(`round-problem-${problemBId}`)
    await expect(rowA).toContainText('Soma')
    await expect(rowA).toContainText('—')
    await expect(rowB).toContainText('Produto')
    await expect(rowB).toContainText('—')
    await expect(page.getByTestId('round-countdown')).toBeVisible()
    await page.screenshot({ path: evidence('02-problemas-sem-pontuacao'), fullPage: true })

    // 03 — closing it live flips the screen into the closed/read-only state
    // with the just-closed notice, no reload.
    await apiCloseRound(roundId)
    await expect(page.getByTestId('round-detail-status-badge')).toContainText('Encerrada', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('round-just-closed-notice')).toBeVisible()
    await expect(page.getByTestId('round-countdown')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-rodada-encerrada-ao-vivo'), fullPage: true })

    // 04 — reload: the closed state persists, but the transient notice does
    // not reappear on a cold load.
    await page.reload()
    await expect(page.getByTestId('round-detail-status-badge')).toContainText('Encerrada')
    await expect(page.getByTestId('round-just-closed-notice')).toHaveCount(0)
    await page.screenshot({ path: evidence('04-rodada-encerrada-apos-reload'), fullPage: true })
  })
})
