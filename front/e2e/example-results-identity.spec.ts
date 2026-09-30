import { somaDosPares } from '@kumite/blocks'
import { expect, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  BACK_URL,
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'
import { organizerAuthHeader } from './support/rounds'

// #197: the examples on `/problem/$id` are refetched on window focus, and an
// organizer may have edited them in between. The run on screen used to be
// paired by index with whatever came back — a ✓ on the wrong example, a
// "3/2 casos" summary. A run whose examples are no longer the loaded ones is
// dropped instead (silently: the participant runs again), and a fresh run
// pairs with the examples it ran against.
const evidence = (name: string) => `e2e/evidence/197/${name}.png`

test.describe('/problem/$id — resultados pareados com os exemplos que os produziram (#197)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    // A closed round: its problem's test cases stay editable (only an open
    // round locks them), and nothing here holds the single-open-round slot.
    ;({ problemId, participantToken, participantId } = await seedEditorFixture(
      'Example Results Identity',
    ))
  })

  test('descarta os resultados quando os exemplos mudam, e a nova execução pareia certo', async ({
    page,
  }) => {
    await seedParticipantToken(page, participantToken)
    await page.addInitScript(
      ([key, saved]) => window.localStorage.setItem(key as string, saved as string),
      [workspaceStorageKey(participantId, problemId), JSON.stringify(somaDosPares)],
    )
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)

    // 01 — a run against the three examples the fixture seeded.
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-summary')).toHaveText('3/3 casos')
    await page.screenshot({ path: evidence('01-antes-da-edicao') })

    // The organizer swaps the first and third visible cases and drops the
    // second, keeping the hidden one publishing requires.
    const edited = await fetch(`${BACK_URL}/organizer/problems/${problemId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await organizerAuthHeader()) },
      body: JSON.stringify({
        testCases: [
          { input: [2, 4, 6, 8], expected: 20, hidden: false },
          { input: [1, 2, 3, 4], expected: 6, hidden: false },
          { input: [10, 11, 12], expected: 22, hidden: true },
        ],
      }),
    })
    expect(edited.status).toBe(200)

    // What the participant's browser sees next: a refetch on window focus.
    // `visibilitychange` on window is the event TanStack Query's
    // focusManager listens for.
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    await expect(page.getByTestId('problem-example-0')).toContainText('[2,4,6,8]')

    // 02 — the old run is gone, not paired by index with the new list: no
    // results card, the band closed again (there is no verdict to keep it
    // open), no toggle.
    await expect(page.getByTestId('problem-results-panel')).toHaveCount(0)
    await expect
      .poll(async () => (await page.getByTestId('results').boundingBox())?.height ?? 0)
      .toBeLessThanOrEqual(1)
    await expect(page.getByTestId('problem-results-toggle')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-resultados-descartados') })

    // 03 — a fresh run pairs each outcome with the example it ran against.
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-summary')).toHaveText('2/2 casos')
    await expect(page.getByTestId('problem-result-0')).toContainText('[2,4,6,8]')
    await expect(page.getByTestId('problem-result-0')).toContainText('obtido 20')
    await expect(page.getByTestId('problem-result-1')).toContainText('[1,2,3,4]')
    await expect(page.getByTestId('problem-result-2')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-nova-execucao') })
  })
})
