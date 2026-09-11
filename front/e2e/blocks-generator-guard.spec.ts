import { raizDesabilitada } from '@kumite/blocks'
import { expect, test } from '@playwright/test'

import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// Visual evidence for #181: a workspace the generator now refuses reaches the
// participant as a message in the results panel, not as a run that "succeeds"
// and then fails every case with `solve is not defined`.
//
// The workspace is seeded into localStorage rather than produced by driving
// Blockly's context menu: the menu is fragile to automate, and the seeded state
// is byte-for-byte what the editor saves after "Disable Block" — which is the
// state the judge would receive anyway.
const evidence = (name: string) => `e2e/evidence/181/${name}.png`

test.describe('generator guards (#181)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Blocks Generator Guard'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('a disabled root block is refused with a message instead of running', async ({ page }) => {
    await page.addInitScript(
      ([key, saved]) => {
        window.localStorage.setItem(key as string, saved as string)
      },
      [`kumite:workspace:${problemId}`, JSON.stringify(raizDesabilitada)],
    )

    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()
    await page.getByTestId('problem-run-button').click()

    // 01 — the refusal names the cause, no case list and no phantom results.
    await expect(page.getByTestId('problem-results-invalid')).toHaveText(
      'Há um bloco desabilitado na sua solução. Reative-o para continuar.',
    )
    await expect(page.getByTestId('problem-result-0')).toHaveCount(0)
    await expect(page.getByTestId('problem-results-summary')).toHaveCount(0)
    await page.screenshot({ path: evidence('01-bloco-desabilitado') })
  })
})
