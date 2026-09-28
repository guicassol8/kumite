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

// Visual walkthrough for #280: a problem reused in a second round. The team
// submitted it 5 times in round 1; its second submission in round 2 is
// "Tentativa 2" on the verdict panel (not the global 7), the same count the
// round's ranking and the problem page's closed notice give. Needs
// ORGANIZER_EMAIL/ORGANIZER_PASSWORD, like every round-driving spec.
const evidence = (name: string) => `e2e/evidence/280/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `attempt-round-e2e-${stamp}@edu.pucrs.br`
const teamName = `Attempt Round E2E ${stamp}`

// The per-team cooldown between two submissions (SUBMISSION_COOLDOWN_MS,
// 5s by default). A 429 only says "wait", so the helper retries until the
// window is over; this bounds it well above the default.
const THROTTLE_RETRIES = 20

test.describe('attempt number within the round (#280)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  // Same fixture as problem.spec.ts: the canonical `somaDosPares` workspace is
  // a known-good solution for these cases.
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

  async function signupThroughUi(page: Page): Promise<string> {
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('E2E Participante')
    await page.getByTestId('signup-email-input').fill(participantEmail)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
    const token = await page.evaluate(() => window.localStorage.getItem('kumite-token'))
    if (!token) throw new Error('expected a session token in localStorage after signup')
    return token
  }

  async function apiCreateTeam(token: string): Promise<void> {
    const res = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: teamName }),
    })
    if (!res.ok) throw new Error(`could not create the team (HTTP ${res.status})`)
  }

  /** One judged submission through the API, waiting out the cooldown on a 429. */
  async function apiSubmit(
    token: string,
    problemId: string,
    roundId: string,
  ): Promise<{ attemptNumber: number; attemptInRound: number }> {
    for (let attempt = 0; attempt < THROTTLE_RETRIES; attempt++) {
      const res = await fetch(`${BACK_URL}/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ problemId, roundId, workspace: somaDosPares }),
      })
      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        continue
      }
      if (res.status !== 201) throw new Error(`submission failed (HTTP ${res.status})`)
      return (await res.json()) as { attemptNumber: number; attemptInRound: number }
    }
    throw new Error('submission still throttled after every retry')
  }

  /** The team's attempt count on the problem, as the round's ranking has it. */
  async function rankingAttempts(token: string, roundId: string, problemId: string) {
    const res = await fetch(`${BACK_URL}/rounds/${roundId}/ranking`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`could not read the ranking (HTTP ${res.status})`)
    const ranking = (await res.json()) as {
      teams: { teamName: string; problems: { problemId: string; attempts: number }[] }[]
    }
    return ranking.teams
      .find((team) => team.teamName === teamName)
      ?.problems.find((problem) => problem.problemId === problemId)?.attempts
  }

  async function seedWorkspace(page: Page, problemId: string, token: string): Promise<void> {
    const userId = await participantIdOf(token)
    await page.evaluate(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [workspaceStorageKey(userId, problemId), JSON.stringify(somaDosPares)],
    )
  }

  test('a reused problem numbers the attempts per round on the verdict panel', async ({
    page,
    roundSlot,
  }) => {
    // Seven judged submissions spaced by the cooldown, plus three editor mounts.
    test.setTimeout(editorTestTimeout(3, 120_000))
    const auth = await organizerAuthHeader()
    const problemId = await apiCreatePublishedProblem()
    const token = await signupThroughUi(page)
    await apiCreateTeam(token)
    await seedWorkspace(page, problemId, token)

    // Round 1: the team submits the problem five times, then the round closes.
    const round1 = await createRound(auth, {
      name: `Rodada 1 Tentativas E2E ${stamp}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    await roundSlot.open(auth, round1)
    for (let n = 1; n <= 5; n++) {
      const result = await apiSubmit(token, problemId, round1)
      expect(result).toMatchObject({ attemptNumber: n, attemptInRound: n })
    }
    await closeRound(auth, round1)
    expect(await rankingAttempts(token, round1, problemId)).toBe(5)

    // 02 — round 1's closed notice counts its own five attempts.
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-closed-best-score')).toContainText('5 tentativas')
    await page.screenshot({ path: evidence('02-rodada-1-encerrada-5-tentativas'), fullPage: true })

    // Round 2 reuses the same problem. The first submission goes through the
    // API: globally it is the sixth, in this round the first.
    const round2 = await createRound(auth, {
      name: `Rodada 2 Tentativas E2E ${stamp}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    await roundSlot.open(auth, round2)
    expect(await apiSubmit(token, problemId, round2)).toMatchObject({
      attemptNumber: 6,
      attemptInRound: 1,
    })

    // 03 — the second one goes through the screen: the panel says
    // "Tentativa 2", never the persisted 7.
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    const submit = page.getByTestId('problem-submit-button')
    await expect(submit).toBeEnabled()
    const verdictResponse = page.waitForResponse(
      (res) => res.url().endsWith('/submissions') && res.request().method() === 'POST',
    )
    // The API submission above started the team's cooldown; a click inside it
    // would only get the throttle banner, so the button is pressed after it.
    await page.waitForTimeout(5_500)
    await submit.click()
    const posted = await (await verdictResponse).json()
    expect(posted).toMatchObject({ attemptNumber: 7, attemptInRound: 2 })
    const attempt = page.getByTestId('problem-verdict-attempt')
    await expect(attempt).toHaveText('Tentativa 2')
    await attempt.scrollIntoViewIfNeeded()
    await page.screenshot({ path: evidence('03-rodada-2-veredito-tentativa-2') })

    // The round's ranking counts the same two attempts the panel shows.
    expect(await rankingAttempts(token, round2, problemId)).toBe(2)

    // 04 — once round 2 closes, the problem page's notice agrees too, and
    // round 1 still keeps its own five.
    await closeRound(auth, round2)
    await page.reload()
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-closed-best-score')).toContainText('2 tentativas')
    await page.screenshot({ path: evidence('04-rodada-2-encerrada-2-tentativas'), fullPage: true })
    expect(await rankingAttempts(token, round1, problemId)).toBe(5)
  })
})
