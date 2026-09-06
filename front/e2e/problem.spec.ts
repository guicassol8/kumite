import { somaDosPares } from '@kumite/blocks'
import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #7: the editor wired to the real catalog and judge,
// replacing the old hardcoded-demo screen. Prereqs (like round-screen.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD, and no round already open in the
// shared dev db.
const evidence = (name: string) => `e2e/evidence/7/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `problem-e2e-participant-${stamp}@edu.pucrs.br`
const teamName = `Problem E2E ${stamp}`
const roundName = `Rodada Problema E2E ${stamp}`

test.describe('problem screen (#7)', () => {
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

  // Test cases mirror somaDosParesProblem.examples exactly, plus one hidden
  // case so publish succeeds: the canonical `somaDosPares` block fixture (sum
  // the even numbers) is then a known-good solution for this real problem too.
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
          { locale: 'pt', title: 'Soma dos Pares', statementMd: 'Some os números pares.' },
          { locale: 'es', title: 'Suma de Pares', statementMd: 'Suma los números pares.' },
          { locale: 'en', title: 'Sum of Evens', statementMd: 'Sum the even numbers.' },
        ],
        testCases: [
          { input: [1, 2, 3, 4], expected: 6, hidden: false },
          { input: [5, 7, 9], expected: 0, hidden: false },
          { input: [2, 4, 6, 8], expected: 20, hidden: false },
          { input: [10, 11, 12], expected: 22, hidden: true },
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

  async function participantToken(page: Page): Promise<string> {
    const token = await page.evaluate(() => window.localStorage.getItem('kumite-token'))
    if (!token) throw new Error('expected a session token in localStorage after signup')
    return token
  }

  async function apiCreateTeam(token: string): Promise<void> {
    await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: teamName }),
    })
  }

  /** The workspace the screen restores on mount, keyed by the real problem id. */
  async function seedWorkspace(page: Page, problemId: string): Promise<void> {
    await page.addInitScript(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [`kumite:workspace:${problemId}`, JSON.stringify(somaDosPares)],
    )
  }

  test('loads the problem from the catalog, submits through the judge, and goes read-only once the round closes', async ({
    page,
  }) => {
    const problemId = await apiCreatePublishedProblem()
    const roundId = await apiCreateRound([problemId])
    await seedWorkspace(page, problemId)

    // 01 — sign up, create a team, then open the round live while the home
    // screen is up (same live-round proof as round-screen.spec.ts).
    await signupThroughUi(page, participantEmail)
    await apiCreateTeam(await participantToken(page))
    await apiOpenRound(roundId)
    await expect(page.getByTestId('home-round-card')).toContainText(roundName, {
      timeout: 15_000,
    })
    await page.getByTestId('home-round-cta').click()
    await expect(page).toHaveURL(new RegExp(`/rounds/${roundId}$`))
    await page.screenshot({ path: evidence('01-rodada-aberta'), fullPage: true })

    // 02 — the round's problem row links into the real problem screen (#7's
    // link back to #39's table).
    const row = page.getByTestId(`round-problem-${problemId}`)
    await expect(row).toContainText('Soma dos Pares')
    await row.getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`/problem/${problemId}$`))
    await expect(page.getByTestId('problem-statement-panel')).toContainText('Soma dos Pares')
    await expect(page.getByTestId('problem-example-0')).toContainText('6')
    await page.screenshot({ path: evidence('02-problema-carregado-do-catalogo'), fullPage: true })

    // 03 — Executar runs the seeded (known-good) solution locally: all three
    // visible cases pass, independent of the server judge.
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()
    await page.getByTestId('problem-run-button').click()
    const localSummary = page.getByTestId('problem-results-summary')
    await expect(localSummary).toHaveText('3/3 casos')
    await page.screenshot({ path: evidence('03-executar-local-passa'), fullPage: true })

    // 04 — Submeter posts the same workspace to the judge: the verdict panel
    // shows the per-case outcome without hiding the local results panel above.
    await page.getByTestId('problem-submit-button').click()
    const verdict = page.getByTestId('problem-verdict-panel')
    await expect(verdict).toBeVisible()
    await expect(page.getByTestId('problem-verdict-case-0')).toContainText('✓')
    await expect(page.getByTestId('problem-verdict-case-1')).toContainText('✓')
    await expect(page.getByTestId('problem-verdict-case-2')).toContainText('✓')
    await expect(page.getByTestId('problem-results-panel')).toBeVisible()
    await page.screenshot({ path: evidence('04-submissao-com-veredito'), fullPage: true })

    // 05 — closing the round and reloading flips the screen to the read-only
    // closed state, with the team's best score instead of a submit button.
    await apiCloseRound(roundId)
    await page.reload()
    await expect(page.getByTestId('problem-closed-notice')).toBeVisible()
    await expect(page.getByTestId('problem-closed-best-score')).toBeVisible()
    await expect(page.getByTestId('problem-submit-button')).toHaveCount(0)
    await page.screenshot({ path: evidence('05-rodada-encerrada-somente-leitura'), fullPage: true })
  })
})
