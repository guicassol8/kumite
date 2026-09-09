import { somaDosPares } from '@kumite/blocks'
import type { Page } from '@playwright/test'

import {
  BACK_URL,
  closeRound,
  createRound,
  E2E_PARTICIPANT_NAME,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
  withRoundLock,
} from './support/rounds'
import { createTeamThroughUi } from './support/teams-ui'

// Visual walkthrough for #40. Prereqs (like teams.spec.ts / organizer-problems.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD — the whole flow hinges on the
// organizer opening/closing a round via the API to prove the home screen
// updates live over SSE (#38), so the suite skips itself without them.
// The single open-round slot is handled by `roundSlot` (#150): it waits for
// whoever holds it, names them when the wait runs out, and closes this spec's
// rounds again even when the test fails halfway through.
const evidence = (name: string) => `e2e/evidence/40/${name}.png`
// Visual walkthrough for #104 (the team's rank/score on a closed round).
const evidence104 = (name: string) => `e2e/evidence/104/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `home-e2e-participant-${stamp}@edu.pucrs.br`
const roundName = `Rodada E2E ${stamp}`
const resultParticipantEmail = `home-e2e-result-${stamp}@edu.pucrs.br`
const resultTeamName = `Resultado E2E ${stamp}`
const resultRoundName = `Rodada Resultado E2E ${stamp}`

test.describe('home (#40)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

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

  // #104's evidence needs a submission that actually scores, so this mirrors
  // "Soma dos Pares" exactly (see run-examples.spec.ts) — `somaDosPares` below
  // is the canonical block solution for these test cases.
  async function apiCreateSomaDosParesProblem(): Promise<string> {
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

  async function apiCreateRound(problemId: string, name: string = roundName): Promise<string> {
    return createRound(await organizerAuthHeader(), {
      name,
      durationMinutes: 30,
      problemIds: [problemId],
    })
  }

  const identityWorkspace = {
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
  }

  async function apiSubmitSolution(
    token: string,
    problemId: string,
    roundId: string,
    workspace: unknown = identityWorkspace,
  ) {
    await fetch(`${BACK_URL}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ problemId, roundId, workspace }),
    })
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

  test('reflects the event live: waiting, an open round, its close, and organizer shortcuts', async ({
    page,
    browser,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    // 01 — a fresh participant with no team, no open round: waiting copy + join CTA.
    await signupThroughUi(page, participantEmail)
    await expect(page.getByTestId('home-round-card')).toContainText('Aguardando a próxima rodada.')
    await expect(page.getByTestId('home-team-cta')).toBeVisible()
    await page.screenshot({ path: evidence('01-aguardando-sem-time'), fullPage: true })

    // 02 — the organizer opens a round via the API while this page stays open;
    // the SSE push (#38) must update the card without a reload (Acceptance #4).
    const problemId = await apiCreatePublishedProblem()
    const roundId = await apiCreateRound(problemId)
    await roundSlot.open(auth, roundId)
    await expect(page.getByTestId('home-round-card')).toContainText(roundName, {
      timeout: 15_000,
    })
    await expect(page.getByTestId('round-countdown')).toBeVisible()
    await page.screenshot({ path: evidence('02-rodada-aberta-ao-vivo'), fullPage: true })

    // 03 — closing it live moves it into the closed-rounds list, no score
    // shown. Under the lock: "Aguardando a próxima rodada" is a statement about
    // the whole event, and the slot this close frees is one another worker can
    // take the instant it is free (#150).
    await withRoundLock(async () => {
      await closeRound(auth, roundId)
      await expect(page.getByTestId('home-round-card')).toContainText(
        'Aguardando a próxima rodada.',
        { timeout: 15_000 },
      )
      const closedCard = page.getByTestId('home-closed-rounds')
      await expect(closedCard).toContainText(roundName)
      await expect(closedCard).not.toContainText(/\d+\s*(pts|pontos|points)/i)
      await page.screenshot({ path: evidence('03-rodada-encerrada'), fullPage: true })
    })

    // 04 — a separate organizer session sees the /organizer/problems shortcut.
    const organizerContext = await browser.newContext()
    const organizerPage = await organizerContext.newPage()
    await organizerPage.goto('/login')
    await organizerPage.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await organizerPage.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await organizerPage.getByTestId('login-submit-button').click()
    await expect(organizerPage.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
    await expect(organizerPage.getByTestId('home-organizer-shortcuts')).toBeVisible()
    await organizerPage.screenshot({ path: evidence('04-atalhos-organizador'), fullPage: true })
    await organizerContext.close()
  })

  test('shows the signed-in team its rank and score once the round closes (#104)', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    // 01 — a participant with a team submits a solution while the round is open.
    await signupThroughUi(page, resultParticipantEmail)
    await page.getByTestId('header-teams-link').click()
    await createTeamThroughUi(page, resultTeamName)

    const problemId = await apiCreateSomaDosParesProblem()
    const roundId = await apiCreateRound(problemId, resultRoundName)
    await roundSlot.open(auth, roundId)
    const token = await loginToken(resultParticipantEmail)
    await apiSubmitSolution(token, problemId, roundId, somaDosPares)

    // 02 — closing the round while this page stays open (SSE, no reload) reveals
    // the team's rank and score next to the round's name (Acceptance).
    await closeRound(auth, roundId)
    await page.goto('/')
    const resultBadge = page.getByTestId(`home-closed-round-result-${roundId}`)
    await expect(resultBadge).toContainText('#1 · 100 pts', { timeout: 15_000 })
    await page.screenshot({ path: evidence104('01-resultado-do-time'), fullPage: true })
  })
})
