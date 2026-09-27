import type { Page } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  seedEditorFixture,
  seedParticipant,
  seedParticipantToken,
} from './support/editor-fixture'
import { BACK_URL, expect, hasOrganizerCredentials, test } from './support/rounds'

// #343: the closed-round notice told a participant *without a team* that
// "Seu time não chegou a submeter…" — there is no team to have not submitted.
// Without a team only the read-only line holds; with a team that never
// submitted, the line stays. "Team submitted → score in the notice" is
// already `problem.spec.ts` (evidence 7/05 and 206/04).
const evidence = (name: string) => `e2e/evidence/343/${name}.png`

const NEVER_SUBMITTED = 'Seu time não chegou a submeter'

/** Opens the closed problem and waits for `/teams`, which decides the line. */
async function openClosedProblem(page: Page, problemId: string): Promise<void> {
  const teams = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/teams' && res.request().method() === 'GET',
  )
  await page.goto(`/problem/${problemId}`)
  await teams
  await expectBlocklyInjected(page)
  await expect(page.getByTestId('problem-closed-notice')).toBeVisible()
  await expect(page.getByTestId('problem-submit-button')).toHaveCount(0)
}

test.describe('/problem/$id — aviso de rodada encerrada depende do time (#343)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let teamlessToken: string
  let teamToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    // A closed round and a participant with neither a team nor a submission.
    ;({ problemId, participantToken: teamlessToken } = await seedEditorFixture('Closed Notice 343'))

    // A second participant whose team never submitted. Creating a team does
    // not need an open round.
    ;({ token: teamToken } = await seedParticipant('Closed Notice 343 Team'))
    const created = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${teamToken}` },
      body: JSON.stringify({ name: `Time 343 ${Date.now()}` }),
    })
    if (!created.ok) throw new Error(`could not create the team (HTTP ${created.status})`)
  })

  test('sem time: só o aviso de somente leitura', async ({ page }) => {
    await seedParticipantToken(page, teamlessToken)
    await openClosedProblem(page, problemId)

    const notice = page.getByTestId('problem-closed-notice')
    await expect(notice).toContainText('somente leitura')
    await expect(page.getByTestId('problem-closed-never-submitted')).toHaveCount(0)
    await expect(notice).not.toContainText('time')
    await page.screenshot({ path: evidence('01-sem-time'), fullPage: true })
  })

  test('time sem submissão: a frase do time continua', async ({ page }) => {
    await seedParticipantToken(page, teamToken)
    await openClosedProblem(page, problemId)

    await expect(page.getByTestId('problem-closed-never-submitted')).toContainText(NEVER_SUBMITTED)
    await page.screenshot({ path: evidence('02-time-sem-submissao'), fullPage: true })
  })

  test('sem time em 390×844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedParticipantToken(page, teamlessToken)
    await openClosedProblem(page, problemId)

    await expect(page.getByTestId('problem-closed-never-submitted')).toHaveCount(0)
    await expect(page.getByTestId('problem-closed-notice')).not.toContainText('time')
    await page.screenshot({ path: evidence('03-sem-time-390'), fullPage: true })
  })
})
