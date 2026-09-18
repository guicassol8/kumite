import type { Page, Request } from '@playwright/test'

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

// Evidence for #274. Prereqs (like round-screen.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
//
// What this proves: every participant screen holds exactly ONE `/sse`
// connection per tab. Before #274, `/problem/$id`, `/rounds/$id` and
// `/leaderboard` each opened their own on top of the app-wide one from
// `RoundStreamProvider`, so those three screens ran two connections per
// participant — 600-800 revalidation queries a second at the event's target
// scale (#135).
//
// `roundSlot` handles the single open-round slot (#150). No `withRoundLock`:
// nothing here asserts on event-wide round state ("no round is running", "mine
// closed last") — only on this tab's own network traffic.
const evidence = (name: string) => `e2e/evidence/274/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `sse-single-e2e-participant-${stamp}@edu.pucrs.br`
const roundName = `Rodada SSE E2E ${stamp}`

/**
 * Tracks the `/sse` connections this tab opens, per window: `reset()` starts a
 * window, and the getters describe only what happened inside it.
 *
 * Two things make a naive count lie, and both are measurement artifacts rather
 * than connections anyone is holding:
 *
 *   - An SSE stream is a request that never completes, and a full page
 *     navigation destroys the outgoing document's stream without Chromium
 *     reporting it as finished or failed — so it would linger as "live"
 *     forever. Scoping to a window drops it with the load that replaced it.
 *   - React StrictMode (dev) runs every effect twice, and the client retries a
 *     dropped stream every SSE_RETRY_DELAY_MS, so a load can *attempt* more
 *     than one connection. The extras are aborted within a few ms.
 *
 * `liveInWindow` is therefore the honest number: connections opened by this
 * load that are still open. `openedInWindow` is kept for the failure message.
 */
function trackSseConnections(page: Page) {
  const live = new Set<Request>()
  let windowRequests: Request[] = []

  const isSse = (request: Request) => new URL(request.url()).pathname.endsWith('/sse')
  const onRequest = (request: Request) => {
    if (!isSse(request)) return
    live.add(request)
    windowRequests.push(request)
  }
  const onSettled = (request: Request) => {
    if (isSse(request)) live.delete(request)
  }

  page.on('request', onRequest)
  page.on('requestfinished', onSettled)
  page.on('requestfailed', onSettled)

  return {
    reset() {
      windowRequests = []
    },
    get liveInWindow() {
      return windowRequests.filter((request) => live.has(request)).length
    },
    get openedInWindow() {
      return windowRequests.length
    },
    stop() {
      page.off('request', onRequest)
      page.off('requestfinished', onSettled)
      page.off('requestfailed', onSettled)
    },
  }
}

test.describe('one SSE connection per tab (#274)', () => {
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
          { locale: 'pt', title: 'Soma SSE', statementMd: 'Enunciado.' },
          { locale: 'es', title: 'Suma SSE', statementMd: 'Enunciado.' },
          { locale: 'en', title: 'Sum SSE', statementMd: 'Statement.' },
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

  test('opens exactly one /sse connection per screen load, and none on in-app navigation', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problemId = await apiCreatePublishedProblem()
    const roundId = await createRound(auth, {
      name: roundName,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    await signupThroughUi(page, participantEmail)
    await roundSlot.open(auth, roundId)

    const sse = trackSseConnections(page)

    /** The tab settles at exactly one open `/sse` stream, and stays there. */
    async function expectExactlyOneLiveConnection(screen: string) {
      await expect
        .poll(() => sse.liveInWindow, {
          message: `${screen} should hold exactly 1 open /sse connection`,
          timeout: 10_000,
        })
        .toBe(1)
    }

    // --- 1. A cold load of each screen holds exactly one connection ---

    // 01 — home. The only screen that already had a single connection before
    // #274; here as the control.
    sse.reset()
    await page.goto('/')
    await expect(page.getByTestId('home-round-card')).toContainText(roundName, {
      timeout: 15_000,
    })
    await expectExactlyOneLiveConnection('home')
    await page.screenshot({ path: evidence('01-home-uma-conexao'), fullPage: true })

    // 02 — /rounds/$id. Held a second connection before #274.
    sse.reset()
    await page.goto(`/rounds/${roundId}`)
    await expect(page.getByTestId(`round-problem-${problemId}`)).toBeVisible()
    await expectExactlyOneLiveConnection('/rounds/$id')
    await page.screenshot({ path: evidence('02-rodada-uma-conexao'), fullPage: true })

    // 03 — /problem/$id. Held a second connection before #274.
    sse.reset()
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('problem-statement-panel')).toBeVisible({ timeout: 30_000 })
    await expectExactlyOneLiveConnection('/problem/$id')
    await page.screenshot({ path: evidence('03-problema-uma-conexao'), fullPage: true })

    // 04 — /leaderboard. Held a second connection before #274; the one the
    // plan's decision D1 resolved by having the provider hold the ranking.
    sse.reset()
    await page.goto('/leaderboard')
    await expect(page.getByTestId('leaderboard-live-chip')).toBeVisible({ timeout: 15_000 })
    await expectExactlyOneLiveConnection('/leaderboard')
    await page.screenshot({ path: evidence('04-leaderboard-uma-conexao'), fullPage: true })

    // --- 2. Moving between those screens through the UI opens nothing ---
    //
    // No reload, so the provider never unmounts and its one connection is
    // simply reused. Before #274 each arrival mounted a screen-owned hook that
    // opened another one on top of it.
    sse.reset()

    await page.getByTestId('header-home-link').click()
    await expect(page.getByTestId('home-round-card')).toContainText(roundName)

    await page.getByTestId('home-round-cta').click()
    await expect(page).toHaveURL(new RegExp(`/rounds/${roundId}$`))
    await expect(page.getByTestId(`round-problem-${problemId}`)).toBeVisible()

    await page.getByTestId(`round-problem-${problemId}`).getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(`/problem/${problemId}$`))
    await expect(page.getByTestId('problem-statement-panel')).toBeVisible({ timeout: 30_000 })

    await page.getByTestId('header-leaderboard-link').first().click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByTestId('leaderboard-live-chip')).toBeVisible({ timeout: 15_000 })

    expect(
      sse.openedInWindow,
      `in-app navigation across all four screens opened ${sse.openedInWindow} extra /sse connections`,
    ).toBe(0)
    // ...and the one connection carried across all four screens is still
    // working: the leaderboard raises this badge after OFFLINE_AFTER_MS with a
    // shut stream, so its absence here is the stream reporting itself alive.
    await expect(page.getByTestId('leaderboard-not-live-badge')).toHaveCount(0)
    await page.screenshot({ path: evidence('05-navegacao-sem-nova-conexao'), fullPage: true })

    sse.stop()
  })
})
