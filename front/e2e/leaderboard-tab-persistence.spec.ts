import type { Page } from '@playwright/test'

import {
  BACK_URL,
  closeRound,
  createRound,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'
import { createTeamThroughUi } from './support/teams-ui'

// Visual walkthrough for #111. Prereqs (like leaderboard.spec.ts / #45):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD. The bug: a round opening or
// closing recomputes the leaderboard's default tab, and the isLoading blip
// around the query-key change used to unmount/remount the (uncontrolled)
// Tabs component, which recalculated `defaultValue` at that instant and
// silently overrode whatever tab the participant had picked by hand.
//
// `test.describe.serial` matters here: the two tests build on shared,
// increasing round state in the same DB — the second deliberately starts from
// the round the first leaves closed. What the first test can no longer assume
// is that NO round has ever existed: that is true of a database exactly once,
// so step 01 stubs the rounds list instead (#150).
const evidence = (name: string) => `e2e/evidence/111/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()

test.describe
  .serial('leaderboard tab selection persists across round open/close (#111)', () => {
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

    async function apiCreateRound(name: string, problemId: string): Promise<string> {
      return createRound(await organizerAuthHeader(), {
        name,
        durationMinutes: 30,
        problemIds: [problemId],
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

    async function goToTeamsAndCreate(page: Page, name: string): Promise<void> {
      await page.getByTestId('header-teams-link').click()
      await createTeamThroughUi(page, name)
    }

    test('keeps the manually selected "Geral" tab when a round opens and flips the default to "Rodada"', async ({
      page,
      roundSlot,
    }) => {
      const auth = await organizerAuthHeader()
      await signupThroughUi(page, `leaderboard-tab-e2e-${stamp}-a@edu.pucrs.br`)
      await goToTeamsAndCreate(page, `Placar Tab E2E A ${stamp}`)

      // 01 — no round has ever existed: the default tab is "Rodada" (empty
      // state), matching today's behavior (Acceptance #2). Stubbed, since a
      // database that has run this suite once already has rounds in it.
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
      await expect(page.getByTestId('leaderboard-tab-round')).toHaveAttribute(
        'data-state',
        'active',
      )
      await page.screenshot({ path: evidence('01-sem-rodada-padrao-rodada'), fullPage: true })
      await page.unroute(roundsApiUrl)

      // 02 — manually switch to "Geral" — a genuine value change, since the
      // default here is "Rodada".
      await page.getByTestId('leaderboard-tab-event').click()
      await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute(
        'data-state',
        'active',
      )
      await page.waitForTimeout(200) // let the tab pill's CSS transition settle
      await page.screenshot({ path: evidence('02-selecao-manual-geral'), fullPage: true })

      // 03 — the organizer opens a round with no submissions yet. The
      // recomputed default flips to "Rodada" (there's now an active round),
      // and a fresh `activeRoundRanking` query key becomes enabled and
      // briefly isPending — the isLoading blip that used to remount the Tabs
      // and discard the manual pick (#111). Wait for that round's own ranking
      // fetch to land (proof the recompute actually happened underneath, not
      // that nothing changed) — "Geral" must still be the one showing.
      const problemId = await apiCreatePublishedProblem()
      const roundId = await apiCreateRound(`Rodada 111a ${stamp}`, problemId)
      const rankingFetched = page.waitForResponse(
        (res) => res.url().includes(`/rounds/${roundId}/ranking`) && res.ok(),
      )
      await roundSlot.open(auth, roundId)
      await rankingFetched
      await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute(
        'data-state',
        'active',
      )
      await page.waitForTimeout(200)
      await page.screenshot({ path: evidence('03-rodada-abre-geral-permanece'), fullPage: true })

      // Close this round so the next test starts from "one round already
      // closed, none active" (test.describe.serial shares this DB).
      await closeRound(auth, roundId)
    })

    test('keeps the manually selected "Rodada" tab when a round closes and flips the default to "Geral"', async ({
      page,
      roundSlot,
    }) => {
      const auth = await organizerAuthHeader()
      await signupThroughUi(page, `leaderboard-tab-e2e-${stamp}-b@edu.pucrs.br`)
      await goToTeamsAndCreate(page, `Placar Tab E2E B ${stamp}`)

      // 04 — a round has already closed (left by the previous test): the
      // default tab is "Geral".
      await page.getByTestId('header-leaderboard-link').click()
      await expect(page).toHaveURL(/\/leaderboard$/)
      await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute(
        'data-state',
        'active',
      )
      await page.screenshot({ path: evidence('04-rodada-fechada-padrao-geral'), fullPage: true })

      // 05 — manually switch to "Rodada" — a genuine value change, since the
      // default here is "Geral". Shows the last closed round.
      await page.getByTestId('leaderboard-tab-round').click()
      await expect(page.getByTestId('leaderboard-last-closed-label')).toBeVisible()
      await page.waitForTimeout(200)
      await page.screenshot({ path: evidence('05-selecao-manual-rodada'), fullPage: true })

      // 06 — the organizer opens and closes a *newer* round while this page
      // stays open. The recomputed default is still "Geral" (a round remains
      // closed either way), but `lastClosedRound` now points at the new round,
      // so `lastClosedRanking`'s query key changes and briefly flips
      // isLoading — the same remount risk as above. In the old, uncontrolled
      // Tabs this always discarded the "Rodada" pick back to "Geral" (the
      // recomputed default), since it was 'Geral' both before and after.
      // Selection must stay "Rodada", now showing the new round's label.
      const roundName = `Rodada 111b ${stamp}`
      const problemId = await apiCreatePublishedProblem()
      const roundId = await apiCreateRound(roundName, problemId)
      await roundSlot.open(auth, roundId)
      await closeRound(auth, roundId)
      await expect(page.getByTestId('leaderboard-last-closed-label')).toContainText(roundName, {
        timeout: 15_000,
      })
      await expect(page.getByTestId('leaderboard-tab-round')).toHaveAttribute(
        'data-state',
        'active',
      )
      await page.waitForTimeout(200)
      await page.screenshot({ path: evidence('06-rodada-fecha-selecao-permanece'), fullPage: true })
    })
  })
