import { expect, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// Visual evidence for #16: the curated toolbox and the root block are what the
// editor actually shows, in the browser, from @kumite/blocks.
// #7 moved the editor behind a real problem id, so `beforeAll` seeds one via
// the shared fixture and every test signs in with a seeded token (#149).
const evidence = (name: string) => `e2e/evidence/16/${name}.png`

const categories = ['Lógica', 'Laços', 'Matemática', 'Texto', 'Listas', 'Variáveis']

test.describe('the curated toolbox (#16)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Curated Toolbox'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('the curated toolbox and the root block come from @kumite/blocks', async ({ page }) => {
    const host = page.getByTestId('blockly-workspace')
    const toolbox = page.locator('.blocklyToolbox')

    // 01 — the six curated categories, and only those.
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    for (const category of categories) {
      await expect(toolbox.getByRole('treeitem', { name: category })).toBeVisible()
    }
    await expect(toolbox.getByRole('treeitem')).toHaveCount(categories.length)
    await page.screenshot({ path: evidence('01-toolbox-curada') })

    // 02 — the workspace opens seeded with the root block.
    await expect(host.getByText('resolver')).toBeVisible()
    await expect(host.getByText('retornar')).toBeVisible()
    await page.screenshot({ path: evidence('02-bloco-raiz-semeado') })

    // 03 — the input block is offered under Variáveis, not as a Blockly variable.
    await toolbox.getByRole('treeitem', { name: 'Variáveis' }).click()
    const flyout = page.locator('.blocklyFlyout')
    await expect(flyout.getByText('entrada')).toBeVisible()
    await page.screenshot({ path: evidence('03-bloco-entrada') })
  })
})
