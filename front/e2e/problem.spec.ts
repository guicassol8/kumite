import { somaDosPares } from '@kumite/blocks'
import type { Page } from '@playwright/test'

import { editorTestTimeout, expectBlocklyInjected } from './support/blockly'
import { participantIdOf, workspaceStorageKey } from './support/editor-fixture'

import {
  BACK_URL,
  closeRound,
  createRound,
  E2E_PARTICIPANT_NAME,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual walkthrough for #7: the editor wired to the real catalog and judge,
// replacing the old hardcoded-demo screen. Prereqs (like round-screen.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD. The single open-round slot is
// handled by `roundSlot` (#150), which also closes this round again when the
// test fails before step 05.
const evidence = (name: string) => `e2e/evidence/7/${name}.png`
// #206: the team's own best score while the round is still open.
const evidence206 = (name: string) => `e2e/evidence/206/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `problem-e2e-participant-${stamp}@edu.pucrs.br`
const teamlessEmail = `problem-e2e-teamless-${stamp}@edu.pucrs.br`
const teamName = `Problem E2E ${stamp}`
const roundName = `Rodada Problema E2E ${stamp}`

test.describe('problem screen (#7)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

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

  async function signupThroughUi(page: Page, email: string): Promise<void> {
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('E2E Participante')
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
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

  /**
   * The workspace the screen restores on mount, under the key of the account
   * that owns it — the participant who signed up on this page (#175).
   *
   * Written straight into the open page rather than through `addInitScript`:
   * the owner only exists once the account does, and from there on the test
   * never loads another document — every step is a client-side navigation, so
   * an init script would never run again.
   */
  async function seedWorkspace(page: Page, problemId: string, token: string): Promise<void> {
    const userId = await participantIdOf(token)
    await page.evaluate(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [workspaceStorageKey(userId, problemId), JSON.stringify(somaDosPares)],
    )
  }

  test('loads the problem from the catalog, submits through the judge, and goes read-only once the round closes', async ({
    page,
    browser,
    roundSlot,
  }) => {
    // Two signups (the team member and, for #206, a teamless participant) and
    // a real judge run, on top of two editor mounts: the row link into the
    // problem and the reload once the round closes.
    test.setTimeout(editorTestTimeout(2, 90_000))
    const auth = await organizerAuthHeader()
    const problemId = await apiCreatePublishedProblem()
    const roundId = await createRound(auth, {
      name: roundName,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    // 01 — sign up, create a team, then open the round live while the home
    // screen is up (same live-round proof as round-screen.spec.ts).
    await signupThroughUi(page, participantEmail)
    const token = await participantToken(page)
    await apiCreateTeam(token)
    await seedWorkspace(page, problemId, token)
    await roundSlot.open(auth, roundId)
    await expect(page.getByTestId('home-round-card')).toContainText(roundName, {
      timeout: 15_000,
    })
    await page.getByTestId('home-round-cta').click()
    await expect(page).toHaveURL(new RegExp(`/rounds/${roundId}$`))
    await page.screenshot({ path: evidence('01-rodada-aberta'), fullPage: true })

    // #206: the team has not submitted yet, so the round list says so instead
    // of the old "—" that could not tell "hidden" from "nothing yet".
    const bestScoreCell = page.getByTestId(`round-problem-best-score-${problemId}`)
    await expect(bestScoreCell).toHaveAttribute('data-state', 'none')
    await expect(bestScoreCell).toHaveText(/Sem submissão/)
    await page.screenshot({ path: evidence206('06-lista-da-rodada-sem-submissao'), fullPage: true })

    // 02 — the round's problem row links into the real problem screen (#7's
    // link back to #39's table).
    const row = page.getByTestId(`round-problem-${problemId}`)
    await expect(row).toContainText('Soma dos Pares')
    await row.getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`/problem/${problemId}$`))
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-statement-panel')).toContainText('Soma dos Pares')
    await expect(page.getByTestId('problem-example-0')).toContainText('6')
    await page.screenshot({ path: evidence('02-problema-carregado-do-catalogo'), fullPage: true })
    await expect(page.getByTestId('problem-no-submission-badge')).toHaveText('Sem submissão')
    await expect(page.getByTestId('problem-best-score-badge')).toHaveCount(0)
    await page.screenshot({ path: evidence206('01-rodada-aberta-sem-submissao'), fullPage: true })

    // 03 — Executar runs the seeded (known-good) solution locally: all three
    // visible cases pass, independent of the server judge.
    await page.getByTestId('problem-run-button').click()
    const localSummary = page.getByTestId('problem-results-summary')
    await expect(localSummary).toHaveText('3/3 casos')
    await page.screenshot({ path: evidence('03-executar-local-passa'), fullPage: true })

    // 04 — Submeter posts the same workspace to the judge: the verdict panel
    // shows the per-case outcome without hiding the local results panel above.
    await page.getByTestId('problem-submit-button').click()
    const verdict = page.getByTestId('problem-verdict-panel')
    await expect(verdict).toBeVisible()
    // Since #219 a case outcome is an icon plus the state in words, and the
    // `✓` this used to read is gone. `data-status` is the stable carrier.
    for (const index of [0, 1, 2]) {
      await expect(page.getByTestId(`problem-verdict-case-${index}`)).toHaveAttribute(
        'data-status',
        'passed',
      )
    }
    await expect(page.getByTestId('problem-results-panel')).toBeVisible()
    await page.screenshot({ path: evidence('04-submissao-com-veredito'), fullPage: true })

    // #206: the 201 refreshes the team's best in place — no reload — while
    // the round is still open.
    const bestBadge = page.getByTestId('problem-best-score-badge')
    await expect(bestBadge).toHaveText(/Melhor do time: \d+/)
    await expect(page.getByTestId('problem-no-submission-badge')).toHaveCount(0)
    const bestScore = (await bestBadge.textContent())?.match(/\d+/)?.[0]
    if (!bestScore) throw new Error('expected a number on the best score badge')
    await page.screenshot({ path: evidence206('02-badge-apos-submeter'), fullPage: true })

    // #206: back on the round list (client-side), the same number in the row.
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`/rounds/${roundId}$`))
    await expect(bestScoreCell).toHaveAttribute('data-state', 'score')
    await expect(bestScoreCell).toHaveText(new RegExp(`\\b${bestScore}$`))
    await page.screenshot({ path: evidence206('03-lista-da-rodada-com-nota'), fullPage: true })

    // #206: a participant with no team sees no team best — "—" on the list
    // and no badge on the problem — and no error either.
    const teamlessContext = await browser.newContext()
    const teamlessPage = await teamlessContext.newPage()
    try {
      await signupThroughUi(teamlessPage, teamlessEmail)
      await teamlessPage.goto(`/rounds/${roundId}`)
      const teamlessCell = teamlessPage.getByTestId(`round-problem-best-score-${problemId}`)
      await expect(teamlessCell).toHaveAttribute('data-state', 'unavailable')
      await expect(teamlessCell).toHaveText(/—/)
      await teamlessPage.screenshot({ path: evidence206('07-lista-sem-time'), fullPage: true })
      await teamlessPage.getByTestId(`round-problem-${problemId}`).getByRole('link').click()
      await expect(teamlessPage.getByTestId('problem-statement-panel')).toContainText(
        'Soma dos Pares',
      )
      await expect(teamlessPage.getByTestId('problem-best-score-badge')).toHaveCount(0)
      await expect(teamlessPage.getByTestId('problem-no-submission-badge')).toHaveCount(0)
      await teamlessPage.screenshot({
        path: evidence206('05-participante-sem-time'),
        fullPage: true,
      })
    } finally {
      await teamlessContext.close()
    }
    await page.goForward()
    await expect(page).toHaveURL(new RegExp(`/problem/${problemId}$`))

    // 05 — closing the round and reloading flips the screen to the read-only
    // closed state, with the team's best score instead of a submit button.
    await closeRound(auth, roundId)
    await page.reload()
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-closed-notice')).toBeVisible()
    await expect(page.getByTestId('problem-closed-best-score')).toBeVisible()
    await expect(page.getByTestId('problem-submit-button')).toHaveCount(0)
    await page.screenshot({ path: evidence('05-rodada-encerrada-somente-leitura'), fullPage: true })
    // #206: closed is exactly as before — the notice carries the score, no badge.
    await expect(page.getByTestId('problem-closed-best-score')).toContainText(bestScore)
    await expect(page.getByTestId('problem-best-score-badge')).toHaveCount(0)
    await page.screenshot({
      path: evidence206('04-rodada-encerrada-sem-regressao'),
      fullPage: true,
    })
  })
})
