import type { Page } from '@playwright/test'

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
  withRoundLock,
} from './support/rounds'
import { createTeamThroughUi } from './support/teams-ui'

// Visual walkthrough for #45. Prereqs (like home.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD — the flow hinges on the organizer
// opening a round and a team submitting via the API, to prove the grid
// updates live over SSE (#44) without a reload. The single open-round slot is
// handled by `roundSlot` (#150), which also closes this round again when the
// test fails before step 05.
const evidence = (name: string) => `e2e/evidence/45/${name}.png`
const evidence46 = (name: string) => `e2e/evidence/46/${name}.png`
const evidence220 = (name: string) => `e2e/evidence/220/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `leaderboard-e2e-${stamp}@edu.pucrs.br`
const teamName = `Placar E2E ${stamp}`
const roundName = `Rodada Placar ${stamp}`

test.describe('leaderboard (#45)', () => {
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
    await page.getByTestId('signup-name-input').fill('E2E Participante')
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

  test('updates the grid live, highlights my team, and switches round/overall scope', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()

    // 01 — a fresh participant with a team, no active round yet: the overall
    // tab with a dedicated empty state. `leaderboard-empty-no-round` means "no
    // round has ever existed", true of a given database exactly once, so the
    // rounds list is stubbed (it is `fetchRounds` in src/lib/rounds-query.ts
    // that feeds this state) — #150.
    await signupThroughUi(page, participantEmail)
    await page.getByTestId('header-teams-link').click()
    await createTeamThroughUi(page, teamName)

    const roundsApiUrl = `${BACK_URL}/rounds`
    await page.route(roundsApiUrl, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        route.continue()
      }
    })
    await page.getByTestId('header-leaderboard-link').click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByTestId('leaderboard-empty-no-round')).toBeVisible()
    await page.screenshot({ path: evidence('01-placar-sem-rodada'), fullPage: true })
    await page.unroute(roundsApiUrl)

    // 02 — the organizer opens a round with a problem while this page stays
    // open; the SSE push (#44) must update the grid without a reload
    // (Acceptance #1). Nobody has submitted yet, so #250's participation
    // filter applies to every team — including my own — and the round-scope
    // empty state shows instead of a table (see leaderboard-phantom-teams.spec.ts).
    const problemId = await apiCreatePublishedProblem()
    const roundId = await createRound(auth, {
      name: roundName,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    await roundSlot.open(auth, roundId)

    await expect(page.getByTestId('leaderboard-empty')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('leaderboard-empty')).toContainText(
      'Ninguém submeteu nesta rodada ainda.',
    )
    await page.screenshot({ path: evidence('02-rodada-aberta-sem-submissoes'), fullPage: true })

    // 03 — the team submits a solution via the API; the live SSE push now
    // brings the table itself into view (Acceptance #1 again, my team's row
    // marked), and the score updates with no interaction on this page.
    const token = await loginToken(participantEmail)
    await apiSubmitSolution(token, problemId, roundId)
    await expect(page.getByTestId('leaderboard-table')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('leaderboard-your-team-badge')).toBeVisible()
    const myRow = page.locator('[data-testid^="leaderboard-row-"]', {
      has: page.getByTestId('leaderboard-your-team-badge'),
    })
    await expect(myRow).toContainText('100', { timeout: 15_000 })
    await page.screenshot({ path: evidence('03-pontuacao-ao-vivo'), fullPage: true })

    // 220-01 — the redesigned normal placar: problem columns as letters with
    // the full title reachable via `title` (no scroll needed to read it), a
    // legend below the table, and the "ao vivo" chip + countdown showing
    // outside presentation mode too (#220 acceptance: no longer exclusive to
    // the telão).
    await expect(page.getByTestId('leaderboard-live-chip')).toBeVisible()
    await expect(page.getByRole('main').getByTestId('round-countdown')).toBeVisible()
    const problemColumn = page.getByTestId(`leaderboard-column-problem-${problemId}`)
    await expect(problemColumn).toHaveText('A')
    await expect(problemColumn).toHaveAttribute('title', 'Identidade')
    await expect(page.getByTestId(`leaderboard-legend-item-${problemId}`)).toContainText(
      'A — Identidade',
    )
    await page.screenshot({ path: evidence220('01-placar-identidade'), fullPage: true })

    // 220-02 — below the cards breakpoint (768px) the table becomes a
    // stacked card per team, and the page itself never grows a horizontal
    // scrollbar at any width (Acceptance).
    await page.setViewportSize({ width: 375, height: 800 })
    await expect(page.getByTestId('leaderboard-table')).toBeVisible()
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalScroll).toBe(false)
    await page.screenshot({ path: evidence220('02-cards-mobile'), fullPage: true })
    await page.setViewportSize({ width: 1280, height: 800 })

    // 46-01 (#46) / 220-03 — toggling the telão enters real fullscreen,
    // forces the dark theme, hides the app header/footer, and shows the
    // round's live chip plus the 96px countdown — state (a) of #220's three
    // telão states, the round from step 02 is still open.
    await page.getByTestId('leaderboard-presentation-toggle').click()
    await expect(page.getByTestId('leaderboard-presentation-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
    await expect(page.getByTestId('app-header')).toBeHidden()
    await expect(page.getByTestId('app-footer')).toBeHidden()
    await expect(page.getByTestId('telao-live-chip')).toBeVisible()
    await expect(page.getByRole('main').getByTestId('round-countdown')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(true)
    await page.screenshot({ path: evidence46('01-modo-apresentacao'), fullPage: true })
    await page.screenshot({ path: evidence220('03-telao-ao-vivo'), fullPage: true })

    // 220-04 through 06, plus the original 04-06 below, all read event-wide
    // round state ("última rodada encerrada", the Geral default) derived
    // from the round this block closes — held under one continuous lock so
    // another worker's round can never be mistaken for this one (#150).
    await withRoundLock(async () => {
      // 220-04 — the organizer closes the round while the telão stays open:
      // state (c), the just-closed round's final ranking with the
      // "encerrada" chip and the closing time in place of the countdown.
      await closeRound(auth, roundId)
      await expect(page.getByTestId('telao-closed-chip')).toContainText(roundName, {
        timeout: 15_000,
      })
      await expect(page.getByTestId('telao-closed-at')).toBeVisible()
      await page.screenshot({ path: evidence220('04-telao-encerrada'), fullPage: true })

      // 220-05 — Esc exits (CDP-dispatched key events don't reach the
      // browser-chrome fullscreen-exit shortcut, so this exercises the
      // `keydown` fallback listener directly, not `fullscreenchange` — see
      // TelaoBoard's own dual-exit comment), restoring the header/footer and
      // the participant's own theme (never the forced dark).
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('leaderboard-presentation-toggle')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      await expect(page.getByTestId('app-header')).toBeVisible()
      await expect(page.getByTestId('app-footer')).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
        .toBe(false)
      await page.screenshot({ path: evidence46('02-modo-normal'), fullPage: true })
      await page.screenshot({ path: evidence220('05-normal-apos-esc'), fullPage: true })

      // 220-06 — reopening the telão with no active round lands on state
      // (b), the accumulated Geral standings — never a resurrected state (c)
      // on a fresh mount, even though a round *did* just close.
      await page.getByTestId('leaderboard-presentation-toggle').click()
      await expect(page.getByTestId('telao-general-badge')).toBeVisible()
      await expect(page.getByTestId('telao-waiting-eyebrow')).toBeVisible()
      await expect(page.getByTestId('telao-closed-chip')).toBeHidden()
      await page.screenshot({ path: evidence220('06-telao-geral'), fullPage: true })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('leaderboard-presentation-toggle')).toHaveAttribute(
        'aria-pressed',
        'false',
      )

      // 04 — switching to "Geral" changes the scope without a reload
      // (Acceptance #3), showing round columns instead of problem columns —
      // the round is closed by now, but the Geral tab lists every round
      // regardless of status.
      await page.getByTestId('leaderboard-tab-event').click()
      await expect(page.getByTestId(`leaderboard-column-round-${roundId}`)).toBeVisible()
      await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute(
        'data-state',
        'active',
      )
      // The active-tab pill background is a CSS transition (transition-all);
      // the data-state flip above is instant but the repaint lags a frame or
      // two behind it, so a screenshot taken right on the assertion catches
      // the old tab still looking highlighted even though the content (just
      // asserted above) has already switched. Let the transition settle.
      await page.waitForTimeout(200)
      await page.screenshot({ path: evidence('04-aba-geral'), fullPage: true })
      await expect(page.getByTestId('leaderboard-tabs')).toBeVisible()
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
      await expect(page.getByTestId('leaderboard-tab-round')).toHaveAttribute(
        'data-state',
        'active',
      )
      await page.waitForTimeout(200) // let the tab pill's CSS transition settle, see #04 above
      await page.screenshot({ path: evidence('06-ultima-rodada-encerrada'), fullPage: true })
    })
  })
})
