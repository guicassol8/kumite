import { somaDosPares } from '@kumite/blocks'

import {
  seedParticipant,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'
import {
  type AuthHeader,
  BACK_URL,
  createRound,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual walkthrough for #285: the organizer pauses submissions from the live
// round card, the participant's editor reacts over SSE without a reload
// (banner, Submeter disabled, timer and Executar still running), and resuming
// lets the next submission through at once. Needs ORGANIZER_EMAIL/
// ORGANIZER_PASSWORD and a seeded db.
//
// The pause is event-wide, but only a submission into an open round can be
// affected by it, and this spec holds the single open-round slot while the
// flag is on (`roundSlot`, #150). The `finally` turns it off again before the
// slot's teardown closes the round, so no other spec ever submits into a pause.
const evidence = (name: string) => `e2e/evidence/285/${name}.png`
const TOKEN_KEY = 'kumite-token'

async function apiCreatePublishedProblem(auth: AuthHeader): Promise<string> {
  const created = await fetch(`${BACK_URL}/organizer/problems`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ difficulty: 'easy' }),
  })
  const { id } = (await created.json()) as { id?: string }
  if (!id) throw new Error(`could not create the problem (HTTP ${created.status})`)
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

async function setPaused(auth: AuthHeader, paused: boolean): Promise<void> {
  const res = await fetch(`${BACK_URL}/organizer/event-config`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ submissionsPaused: paused }),
  })
  if (!res.ok) throw new Error(`could not set submissionsPaused=${paused} (HTTP ${res.status})`)
}

test.describe('submissions pause (#285)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')
  test.setTimeout(120_000)

  test('pausing reaches the open editor live, keeps the timer and Run going, and resuming accepts at once', async ({
    browser,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const organizerToken = auth.authorization?.replace(/^Bearer /, '') ?? ''
    const problemId = await apiCreatePublishedProblem(auth)
    const roundId = await createRound(auth, {
      name: `Rodada Pausa E2E ${Date.now()}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    const participant = await seedParticipant('submissions-pause')
    await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${participant.token}` },
      body: JSON.stringify({ name: `Pausa E2E ${Date.now()}` }),
    })

    // Start from a known state: a previous run killed mid-test could have
    // left the flag on.
    await setPaused(auth, false)

    const organizerContext = await browser.newContext()
    const participantContext = await browser.newContext()
    try {
      const organizerPage = await organizerContext.newPage()
      await organizerPage.addInitScript(
        ([key, value]) => window.localStorage.setItem(key as string, value as string),
        [TOKEN_KEY, organizerToken],
      )
      const participantPage = await participantContext.newPage()
      await seedParticipantToken(participantPage, participant.token)
      await participantPage.addInitScript(
        ([key, state]) => window.localStorage.setItem(key as string, state as string),
        [workspaceStorageKey(participant.id, problemId), JSON.stringify(somaDosPares)],
      )

      await roundSlot.open(auth, roundId)

      await participantPage.goto(`/problem/${problemId}`)
      await expect(participantPage.getByTestId('problem-statement-panel')).toContainText(
        'Soma dos Pares',
      )
      await expect(
        participantPage.getByTestId('blockly-workspace').locator('svg.blocklySvg'),
      ).toBeVisible()
      await expect(participantPage.getByTestId('problem-submit-button')).toBeEnabled()

      // 01 — the organizer pauses from the live round card.
      await organizerPage.goto('/organizer')
      const toggle = organizerPage.getByTestId('overview-round-pause-toggle')
      await expect(toggle).toHaveText('Pausar submissões')
      await toggle.click()
      await expect(organizerPage.getByTestId('overview-submissions-paused-badge')).toBeVisible()
      await expect(toggle).toHaveText('Retomar submissões')
      // The SSE flip can beat the PATCH response; wait for the mutation to
      // settle so the capture shows the button as the organizer will use it.
      await expect(toggle).toBeEnabled()
      await organizerPage.mouse.move(0, 0)
      await organizerPage.screenshot({
        path: evidence('01-organizer-card-pausado'),
        fullPage: true,
        animations: 'disabled',
      })

      // 02 — the participant's editor learns it over SSE, no reload: banner
      // on, Submeter off, Executar still judging locally, timer still ticking.
      await expect(participantPage.getByTestId('problem-submissions-paused-banner')).toBeVisible()
      await expect(participantPage.getByTestId('problem-submit-button')).toBeDisabled()
      const countdown = participantPage.getByTestId('round-countdown').first()
      const before = await countdown.textContent()
      await participantPage.getByTestId('problem-run-button').click()
      await expect(participantPage.getByTestId('problem-results-summary')).toHaveText('3/3 casos')
      await expect(countdown).not.toHaveText(before ?? '', { timeout: 5_000 })
      await participantPage.screenshot({
        path: evidence('02-editor-pausado'),
        fullPage: true,
        animations: 'disabled',
      })

      // 03 — the organizer resumes; the banner goes away live and the next
      // submission is judged straight away (no cooldown left by the pause).
      await toggle.click()
      await expect(toggle).toHaveText('Pausar submissões')
      await expect(organizerPage.getByTestId('overview-submissions-paused-badge')).toHaveCount(0)
      await expect(participantPage.getByTestId('problem-submissions-paused-banner')).toHaveCount(0)
      await expect(participantPage.getByTestId('problem-submit-button')).toBeEnabled()
      await participantPage.getByTestId('problem-submit-button').click()
      await expect(participantPage.getByTestId('problem-verdict-panel')).toBeVisible()
      for (const index of [0, 1, 2]) {
        await expect(participantPage.getByTestId(`problem-verdict-case-${index}`)).toHaveAttribute(
          'data-status',
          'passed',
        )
      }
      await participantPage.screenshot({
        path: evidence('03-editor-retomado'),
        fullPage: true,
        animations: 'disabled',
      })

      // 04 — the same flag, from /organizer/event-config: off, on, off.
      await organizerPage.goto('/organizer/event-config')
      const configSwitch = organizerPage.getByTestId('event-config-submissions-paused-switch')
      await expect(configSwitch).toHaveAttribute('aria-checked', 'false')
      await configSwitch.click()
      await expect(configSwitch).toHaveAttribute('aria-checked', 'true')
      await expect(participantPage.getByTestId('problem-submissions-paused-banner')).toBeVisible()
      await organizerPage.screenshot({
        path: evidence('04-event-config-toggle-ligado'),
        fullPage: true,
        animations: 'disabled',
      })
      await configSwitch.click()
      await expect(configSwitch).toHaveAttribute('aria-checked', 'false')
      await expect(participantPage.getByTestId('problem-submissions-paused-banner')).toHaveCount(0)
      await organizerPage.mouse.move(0, 0)
      await organizerPage.screenshot({
        path: evidence('05-event-config-toggle-desligado'),
        fullPage: true,
        animations: 'disabled',
      })
    } finally {
      await setPaused(auth, false)
      await organizerContext.close()
      await participantContext.close()
    }
  })
})
