import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #45. Prereqs (like home.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD — the flow hinges on the organizer
// opening a round and a team submitting via the API, to prove the grid
// updates live over SSE (#44) without a reload. Also needs no round already
// open in the shared dev db (a fresh `pnpm db:seed` never opens one).
const evidence = (name: string) => `e2e/evidence/45/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `leaderboard-e2e-${stamp}@edu.pucrs.br`
const teamName = `Placar E2E ${stamp}`
const roundName = `Rodada Placar ${stamp}`

test.describe('leaderboard (#45)', () => {
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
          { locale: 'pt', title: 'Identidade', statementMd: 'Devolva a entrada.' },
          { locale: 'es', title: 'Identidad', statementMd: 'Devuelve la entrada.' },
          { locale: 'en', title: 'Identity', statementMd: 'Return the input.' },
        ],
        testCases: [
          { input: 1, expected: 1, hidden: false },
          { input: 2, expected: 2, hidden: true },
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
    const res = await fetch(`${BACK_URL}/organizer/rounds/${roundId}/open`, {
      method: 'POST',
      headers: auth,
    })
    if (!res.ok) throw new Error(`failed to open round: ${res.status} ${await res.text()}`)
  }

  async function apiCloseRound(roundId: string): Promise<void> {
    const auth = await organizerAuthHeader()
    await fetch(`${BACK_URL}/organizer/rounds/${roundId}/close`, { method: 'POST', headers: auth })
  }

  async function apiSubmitSolution(token: string, problemId: string, roundId: string) {
    await fetch(`${BACK_URL}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        problemId,
        roundId,
        workspace: {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'kumite_solve',
                id: 'raiz',
                inputs: { RETURN: { block: { type: 'kumite_input', id: 'entrada' } } },
              },
            ],
          },
        },
      }),
    })
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

  async function loginToken(email: string): Promise<string> {
    const res = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    const { token } = (await res.json()) as { token: string }
    return token
  }

  test('updates the grid live, highlights my team, and switches round/overall scope', async ({
    page,
  }) => {
    // 01 — a fresh participant with a team, no active round yet: the overall
    // tab (no round has ever existed) with a dedicated empty state.
    await signupThroughUi(page, participantEmail)
    await page.getByTestId('header-teams-link').click()
    await page.getByTestId('teams-create-open').click()
    await page.getByTestId('teams-create-name-input').fill(teamName)
    await page.getByTestId('teams-create-submit').click()
    await expect(page.getByTestId('my-team-panel')).toBeVisible()

    await page.getByTestId('header-leaderboard-link').click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByTestId('leaderboard-empty-no-round')).toBeVisible()
    await page.screenshot({ path: evidence('01-placar-sem-rodada'), fullPage: true })

    // 02 — the organizer opens a round with a problem while this page stays
    // open; the SSE push (#44) must update the grid without a reload
    // (Acceptance #1), and my team's row is marked.
    const problemId = await apiCreatePublishedProblem()
    const roundId = await apiCreateRound(problemId)
    await apiOpenRound(roundId)

    await expect(page.getByTestId('leaderboard-table')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('leaderboard-your-team-badge')).toBeVisible()
    await page.screenshot({ path: evidence('02-rodada-aberta-ao-vivo'), fullPage: true })

    // 03 — the team submits a solution via the API; the score updates live,
    // with no interaction on this page (Acceptance #1 again, this time the
    // cell value itself).
    const token = await loginToken(participantEmail)
    await apiSubmitSolution(token, problemId, roundId)
    const myRow = page.locator('[data-testid^="leaderboard-row-"]', {
      has: page.getByTestId('leaderboard-your-team-badge'),
    })
    await expect(myRow).toContainText('100', { timeout: 15_000 })
    await page.screenshot({ path: evidence('03-pontuacao-ao-vivo'), fullPage: true })

    // 04 — switching to "Geral" changes the scope without a reload
    // (Acceptance #3), showing round columns instead of problem columns.
    await page.getByTestId('leaderboard-tab-event').click()
    await expect(page.getByTestId(`leaderboard-column-round-${roundId}`)).toBeVisible()
    await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute('data-state', 'active')
    // The active-tab pill background is a CSS transition (transition-all);
    // the data-state flip above is instant but the repaint lags a frame or
    // two behind it, so a screenshot taken right on the assertion catches
    // the old tab still looking highlighted even though the content (just
    // asserted above) has already switched. Let the transition settle.
    await page.waitForTimeout(200)
    await page.screenshot({ path: evidence('04-aba-geral'), fullPage: true })

    // 05 — the organizer closes the round while this page stays open — no
    // reload. The live `round.closed` push must refetch the rounds list on
    // its own; "Geral" (already selected from step 04) keeps working
    // uninterrupted through that.
    await apiCloseRound(roundId)
    await expect(page.getByTestId('leaderboard-tabs')).toBeVisible()
    await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 15_000 },
    )
    await page.screenshot({ path: evidence('05-geral-por-padrao'), fullPage: true })

    // 06 — switching to "Rodada" (still no reload) falls back to the round
    // that just closed, labeled as such (Acceptance #2). This is exactly the
    // live path a prior review found broken: without `round.closed` also
    // refetching the rounds list, this label never appeared — only a reload
    // (which this spec used to do) masked the gap.
    await page.getByTestId('leaderboard-tab-round').click()
    await expect(page.getByTestId('leaderboard-last-closed-label')).toContainText(roundName, {
      timeout: 15_000,
    })
    await expect(page.getByTestId('leaderboard-tab-round')).toHaveAttribute('data-state', 'active')
    await page.waitForTimeout(200) // let the tab pill's CSS transition settle, see #04 above
    await page.screenshot({ path: evidence('06-ultima-rodada-encerrada'), fullPage: true })
  })
})
