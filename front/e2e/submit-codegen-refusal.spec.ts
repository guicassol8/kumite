import { messagesFor, raizDesabilitada } from '@kumite/blocks'

import { editorTestTimeout, expectBlocklyInjected } from './support/blockly'
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
  hasOrganizerCredentials,
  organizerAuthHeader,
  test,
} from './support/rounds'

// #316: a Submeter the codegen refuses. The back answers 400 with the
// refusal already localized by @kumite/blocks, before judging anything — no
// submission row, no cooldown — and problem-submit-error-banner is the only
// place the participant reads why. This covers Submeter; its Executar twin,
// with the same `raizDesabilitada` workspace, is blocks-generator-guard.spec.ts
// (#181).
//
// Submitting needs a round that is really open, so the round goes through
// `roundSlot` (closed on teardown even when the test fails). The participant
// and the team are made through the API, not the signup screen.
const evidence = (name: string) => `e2e/evidence/316/${name}.png`

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

test.describe('submit refused by the codegen (#316)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')
  // Two editor mounts: the first visit and the reload.
  test.setTimeout(editorTestTimeout(2))

  test('a disabled root block is refused on Submeter with the localized message and no score', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problemId = await apiCreatePublishedProblem(auth)
    const roundId = await createRound(auth, {
      name: `Rodada Recusa E2E ${Date.now()}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    const participant = await seedParticipant('submit-codegen-refusal')
    const team = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${participant.token}` },
      body: JSON.stringify({ name: `Recusa E2E ${Date.now()}` }),
    })
    if (!team.ok) throw new Error(`could not create the team (HTTP ${team.status})`)

    await seedParticipantToken(page, participant.token)
    await page.addInitScript(
      ([key, saved]) => window.localStorage.setItem(key as string, saved as string),
      [workspaceStorageKey(participant.id, problemId), JSON.stringify(raizDesabilitada)],
    )

    await roundSlot.open(auth, roundId)

    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-no-submission-badge')).toHaveText('Sem submissão')
    const submit = page.getByTestId('problem-submit-button')
    await expect(submit).toBeEnabled()
    await submit.click()

    // 01 — the refusal reaches the participant in the submit banner, in the
    // words @kumite/blocks localized; it is not a cooldown.
    const banner = page.getByTestId('problem-submit-error-banner')
    await expect(banner).toBeVisible()
    // toContainText: the banner also holds its "dismiss" button.
    await expect(banner).toContainText(messagesFor('pt').errorDisabledBlock)
    await expect(page.getByTestId('problem-cooldown-banner')).toHaveCount(0)

    // No case list and no score for this attempt, and Submeter is back at
    // once: a refusal arms no cooldown.
    for (const id of [
      'problem-verdict-panel',
      'problem-verdict-case-0',
      'problem-result-0',
      'problem-results-summary',
      'problem-best-score-badge',
    ]) {
      await expect(page.getByTestId(id)).toHaveCount(0)
    }
    await expect(submit).toBeEnabled()
    await page.screenshot({ path: evidence('01-submit-recusado') })

    // 02 — the server agrees: after a reload the team still has no
    // submission, so the refusal recorded neither an attempt nor a score.
    await page.reload()
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-no-submission-badge')).toHaveText('Sem submissão')
    await expect(page.getByTestId('problem-best-score-badge')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-sem-pontuacao-apos-recarregar') })
  })
})
