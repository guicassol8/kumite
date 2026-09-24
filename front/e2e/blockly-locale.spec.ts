import { expect, test } from '@playwright/test'

import {
  dragBlockFromFlyout,
  EDITOR_TEST_TIMEOUT_MS,
  expectBlocklyInjected,
} from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// Visual walkthrough for #57, one screenshot per acceptance criterion.
// #7 moved the editor behind a real problem id, so `beforeAll` seeds one via
// the shared fixture and every test signs in with a seeded token (#149). The
// seeded problem carries an `es` translation, so the screen is Spanish end to
// end for this describe's `es-MX` browser.
const evidence = (name: string) => `e2e/evidence/57/${name}.png`

test.describe('browser detected as Spanish (es-MX)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.use({ locale: 'es-MX' })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Blockly Locale'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('the toolbox and blocks open in Spanish, and switching to English re-renders them without losing the workspace', async ({
    page,
  }) => {
    const host = page.getByTestId('blockly-workspace')
    const toolbox = page.locator('.blocklyToolbox')
    const draggedBlock = host.locator('g.blocklyDraggable:visible').first()

    // 01 — a Spanish-language visitor sees the toolbox and the root block in
    // Spanish.
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expect(toolbox.getByRole('treeitem', { name: 'Bucles' })).toBeVisible()
    await expect(toolbox.getByRole('treeitem', { name: 'Matemáticas' })).toBeVisible()
    await expect(host.getByText('resolver', { exact: true })).toBeVisible()
    await expect(host.getByText('devolver', { exact: true })).toBeVisible()
    await page.screenshot({ path: evidence('01-toolbox-y-bloque-raiz-en-espanol') })

    // 02 — a block placed while in Spanish is on the canvas, ready to prove it
    // survives the language switch below.
    await dragBlockFromFlyout(page, 'Matemáticas')
    await expect(draggedBlock).toBeVisible()
    await page.screenshot({ path: evidence('02-bloque-agregado-en-espanol') })

    // 03 — switching to English re-renders the toolbox and the root block in
    // English, and the block placed in step 02 is still there.
    await page.getByTestId('language-option-en').click()
    await expect(toolbox.getByRole('treeitem', { name: 'Loops' })).toBeVisible()
    await expect(toolbox.getByRole('treeitem', { name: 'Math' })).toBeVisible()
    await expect(host.getByText('solve', { exact: true })).toBeVisible()
    await expect(host.getByText('return', { exact: true })).toBeVisible()
    await expect(draggedBlock).toBeVisible()
    await page.screenshot({ path: evidence('03-cambiado-a-ingles-preserva-el-bloque') })
  })
})
