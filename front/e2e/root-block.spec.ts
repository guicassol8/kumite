import { expect, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual walkthrough for #4: the protected root block, the pt-br locale of the
// native Blockly blocks and the Variables category that can create variables.
// #7 moved the editor behind a real problem id — this suite only needs to
// *view* one, so `beforeAll` seeds a problem+round once via the shared fixture
// and every test signs in with a seeded token instead of the UI.
const evidence = (name: string) => `e2e/evidence/4/${name}.png`

const ROOT = '[data-id="kumiteSolveRoot"]'

function contextMenu(page: Page) {
  return page.locator('.blocklyContextMenu')
}

// The root block is a C shape: the centre of its bounding box is the hole in
// the middle, where the canvas background swallows the click. Its label is
// solid ground.
function rootLabel(page: Page) {
  return page.locator(ROOT).getByText('resolver')
}

async function dragBlockFromCategory(page: Page, category: string) {
  await page.locator('.blocklyToolbox').getByRole('treeitem', { name: category }).click()
  const flyoutBlock = page.locator('.blocklyFlyout g.blocklyDraggable').first()
  await expect(flyoutBlock).toBeVisible()
  const source = await flyoutBlock.boundingBox()
  const canvas = await page.getByTestId('blockly-workspace').boundingBox()
  if (!source || !canvas) throw new Error('the flyout block or the canvas has no box')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width * 0.65, canvas.y + canvas.height * 0.7, {
    steps: 12,
  })
  await page.mouse.up()
}

test.describe('the root block and native blocks (#4)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Root Block'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('the native blocks speak pt-br and the root block cannot be deleted or duplicated', async ({
    page,
  }) => {
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyFlyout')

    // 01 — the native Blockly blocks are translated by the official locale pack:
    // "repita … vezes", not "repeat … times".
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await toolbox.getByRole('treeitem', { name: 'Laços' }).click()
    await expect(flyout.getByText('repita').first()).toBeVisible()
    await expect(flyout.getByText('vezes').first()).toBeVisible()
    await expect(flyout.getByText('para cada item').first()).toBeVisible()
    await page.screenshot({ path: evidence('01-blocos-nativos-pt-br') })

    // 02 — the root block's context menu offers neither "Deletar bloco" nor
    // "Duplicar", nor "Desabilitar bloco" (#239).
    await page.keyboard.press('Escape')
    await rootLabel(page).click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    await expect(contextMenu(page).getByText('Deletar bloco')).toHaveCount(0)
    await expect(contextMenu(page).getByText('Duplicar')).toHaveCount(0)
    await expect(contextMenu(page).getByText('Desabilitar bloco')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-menu-raiz-protegido') })

    // 03 — a block dragged from the toolbox still offers both: the protection is
    // the root block's, not a global lockdown of the editor. "Desabilitar bloco"
    // is gone everywhere (#239): a disabled block is refused by the codegen.
    await page.keyboard.press('Escape')
    await dragBlockFromCategory(page, 'Matemática')
    const dragged = page
      .getByTestId('blockly-workspace')
      .locator(`g.blocklyDraggable:visible:not(${ROOT})`)
      .first()
    await expect(dragged).toBeVisible()
    await dragged.click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    await expect(contextMenu(page).getByText('Deletar bloco')).toBeVisible()
    await expect(contextMenu(page).getByText('Duplicar')).toBeVisible()
    await expect(contextMenu(page).getByText('Desabilitar bloco')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-menu-bloco-comum') })

    // 04 — selecting the root and pressing Delete leaves it exactly where it was.
    await page.keyboard.press('Escape')
    await rootLabel(page).click()
    await expect(page.locator(`${ROOT}.blocklySelected`)).toHaveCount(1)
    await page.keyboard.press('Delete')
    await expect(page.locator(ROOT)).toHaveCount(1)
    await expect(rootLabel(page)).toBeVisible()
    await page.screenshot({ path: evidence('04-raiz-sobrevive-delete') })
  })

  test('the Variables category can create more than one variable', async ({ page }) => {
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyFlyout')

    // 05 — "Criar variável..." exists (the static category Blockly would build
    // has no such button), and both variables end up offered in the flyout.
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)

    // Clicking a category toggles its flyout, so the category is opened once and
    // both variables are created from the flyout that stays open — which is also
    // what proves it rebuilds itself after each new variable.
    await toolbox.getByRole('treeitem', { name: 'Variáveis' }).click()

    for (const name of ['soma', 'numero']) {
      const createButton = flyout.locator('.blocklyFlyoutButton').getByText('Criar variável...')
      await expect(createButton).toBeVisible()
      await createButton.click()

      // The app's own dialog (#205), not Blockly's prompt.
      const dialog = page.getByTestId('create-variable-dialog')
      await expect(dialog).toBeVisible()
      await page.getByTestId('create-variable-input').fill(name)
      await page.getByTestId('create-variable-confirm').click()
      await expect(dialog).toBeHidden()
    }

    await expect(flyout.getByText('soma', { exact: true }).first()).toBeVisible()
    await expect(flyout.getByText('numero', { exact: true }).first()).toBeVisible()
    await expect(flyout.getByText('entrada', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: evidence('05-criar-variavel') })
  })

  test('a saved workspace that lost the root block gets it back with its blocks', async ({
    page,
  }) => {
    // 06 — localStorage seeded with a state that has no root block: the screen
    // re-seeds the root and keeps what was saved, instead of stranding the
    // participant with a workspace the toolbox cannot rebuild.
    await page.addInitScript(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [
        workspaceStorageKey(participantId, problemId),
        JSON.stringify({
          blocks: {
            languageVersion: 0,
            blocks: [
              { type: 'math_number', id: 'salvoSemRaiz', x: 260, y: 60, fields: { NUM: 42 } },
            ],
          },
        }),
      ],
    )

    await page.goto(`/problem/${problemId}`)
    const host = page.getByTestId('blockly-workspace')

    await expectBlocklyInjected(page)
    await expect(page.locator(ROOT)).toHaveCount(1)
    await expect(page.locator('[data-id="salvoSemRaiz"]')).toHaveCount(1)
    await expect(host.getByText('42')).toBeVisible()
    await page.screenshot({ path: evidence('06-restore-sem-raiz') })
  })
})
