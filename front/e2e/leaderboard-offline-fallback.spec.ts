import type { Page } from '@playwright/test'

import {
  BACK_URL,
  createRound,
  E2E_PARTICIPANT_NAME,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'
import { createTeamThroughUi } from './support/teams-ui'

// Visual walkthrough for #180: /leaderboard with the `/sse` stream blocked —
// the venue's proxy, a corporate firewall, the auditorium's wifi. Prereqs
// (like leaderboard.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD: the round this spec opens is what
// proves the REST fallback derives the *open* round instead of falling back to
// the last closed one. `roundSlot` owns the single open-round slot and closes
// the round again even if the test fails mid-assertion (#150) — and
// `withRoundLock` is deliberately not used here: it must not wrap
// `roundSlot.open` (the helper refuses to run nested), and the only round
// state this spec asserts on is its own round while it is open, which the slot
// already serializes.
const evidence = (name: string) => `e2e/evidence/180/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `leaderboard-offline-e2e-${stamp}@edu.pucrs.br`
const teamName = `Placar Offline E2E ${stamp}`
const roundName = `Rodada Offline ${stamp}`

test.describe('leaderboard without SSE (#180)', () => {
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
    await page.getByTestId('signup-name-input').fill(E2E_PARTICIPANT_NAME)
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
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

  test('falls back to REST, signals "not live", and keeps the error state reachable', async ({
    page,
    roundSlot,
  }) => {
    // Signup + team + problem + round + a 6s wait for the offline threshold
    // and a reload: comfortably past Playwright's 30s default.
    test.setTimeout(180_000)

    const auth = await organizerAuthHeader()
    await signupThroughUi(page, participantEmail)
    await page.getByTestId('header-teams-link').click()
    await createTeamThroughUi(page, teamName)

    // The round is open *before* the screen is ever shown, and the stream is
    // dead the whole time: the only way /leaderboard can know about it is
    // GET /rounds.
    const problemId = await apiCreatePublishedProblem()
    const roundId = await createRound(auth, {
      name: roundName,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    await roundSlot.open(auth, roundId)
    await apiSubmitSolution(await loginToken(participantEmail), problemId, roundId)

    // This is the failure being reproduced: /sse never connects. Aborting it
    // is what a blocking proxy does — the client retries every 2s and never
    // reaches 'open'.
    await page.route('**/sse', (route) => route.abort())

    // Reload so the block actually applies to the connection this screen uses.
    // Since #274 the leaderboard reads the app-wide connection opened by
    // `RoundStreamProvider` instead of opening its own on mount — and that one
    // was established back at signup, before the route above existed, so
    // without this the screen would arrive already live and fully populated.
    // The reload tears it down and reopens it through the block, which is the
    // state this spec is about.
    await page.reload()
    await expect(page.getByTestId('header-leaderboard-link')).toBeVisible()

    // 01 — the loading state, held open on purpose by delaying the first
    // GET /ranking. Before the fix the screen stayed here forever, because
    // `isLoading` included the very condition that enabled the REST fallback.
    let delayEventRanking = true
    await page.route(`${BACK_URL}/ranking`, async (route) => {
      if (delayEventRanking) {
        delayEventRanking = false
        await new Promise((resolve) => setTimeout(resolve, 3_000))
      }
      await route.continue()
    })
    await page.getByTestId('header-leaderboard-link').click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByTestId('leaderboard-loading')).toBeVisible()
    await page.screenshot({ path: evidence('01-carregando'), fullPage: true })

    // 02 — the fallback renders (Acceptance #1), and the screen says out loud
    // that it is not live (Acceptance #2): the badge next to the title — the
    // signal that survives presentation mode — plus the offline banner. The
    // badge only shows after OFFLINE_AFTER_MS (6s) of a shut connection, so a
    // blip that reconnects never flashes it.
    await expect(page.getByTestId('leaderboard-tabs')).toBeVisible()
    await expect(page.getByTestId('leaderboard-not-live-badge')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('leaderboard-connection-banner')).toContainText(
      'Sem conexão ao vivo',
    )
    await page.getByTestId('leaderboard-tab-event').click()
    await expect(page.getByTestId('leaderboard-table')).toBeVisible()
    await page.waitForTimeout(200) // let the tab pill's CSS transition settle
    await page.screenshot({ path: evidence('02-fallback-rest-geral'), fullPage: true })

    // 03 — the "Rodada" tab shows the round that is actually *open*, sourced
    // from GET /rounds. Before the fix `hasActiveRound` came from the stream
    // alone, so this tab showed the last *closed* round, labeled as such —
    // the wrong round on the venue's big screen.
    await page.getByTestId('leaderboard-tab-round').click()
    await expect(page.getByTestId(`leaderboard-column-problem-${problemId}`)).toBeVisible()
    await expect(page.getByTestId('leaderboard-last-closed-label')).toBeHidden()
    await expect(page.getByTestId('leaderboard-your-team-badge')).toBeVisible()
    await page.waitForTimeout(200)
    await page.screenshot({ path: evidence('03-rodada-aberta-via-rest'), fullPage: true })

    // 04 — with the REST fallback down too, the error state and its retry are
    // reachable at last (Acceptance #3). It was unreachable before the fix for
    // the same reason as 01: the branch is `!isLoading && isError`. The reload
    // is what makes this a real "nothing loaded" case — a live page still
    // holds the cached ranking, and data must never be hidden by a failure.
    for (const pattern of [
      `${BACK_URL}/teams`,
      `${BACK_URL}/rounds`,
      `${BACK_URL}/ranking`,
      `${BACK_URL}/rounds/*/ranking`,
    ]) {
      await page.route(pattern, (route) => route.abort())
    }
    await page.reload()
    await expect(page.getByTestId('leaderboard-error')).toBeVisible()
    await expect(page.getByTestId('leaderboard-error-retry')).toBeEnabled()
    await page.screenshot({ path: evidence('04-erro-com-retry'), fullPage: true })
  })
})
