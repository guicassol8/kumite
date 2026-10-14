import { expect, type Locator, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// #335 — a variable dropdown's "Renomear variável..." and "Deletar a variável
// '…'" open the app's own dialogs, not Blockly's `<dialog class="blocklyDialog">`:
// a refused name is explained inside the dialog, cancelling changes nothing,
// and a variable in use goes only after a confirmation.
const evidence = (name: string) => `e2e/evidence/335/${name}.png`

// The three blocks that use `x`: `x ← 5` in the body, `x` as the return, and
// a loose `x` on the canvas — the one whose dropdown the tests open.
const USES = ['setX', 'getReturn', 'getLoose'] as const

const saved = JSON.stringify({
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'kumiteSolveRoot',
        x: 40,
        y: 40,
        deletable: false,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'setX',
              fields: { VAR: { id: 'varX' } },
              inputs: {
                VALUE: { block: { type: 'math_number', id: 'five', fields: { NUM: 5 } } },
              },
            },
          },
          RETURN: {
            block: { type: 'variables_get', id: 'getReturn', fields: { VAR: { id: 'varX' } } },
          },
        },
      },
      { type: 'variables_get', id: 'getLoose', x: 460, y: 60, fields: { VAR: { id: 'varX' } } },
      // `y`'s only use: deleting it from here asks nothing (P3).
      { type: 'variables_get', id: 'getY', x: 460, y: 160, fields: { VAR: { id: 'varY' } } },
    ],
  },
  variables: [
    { name: 'x', id: 'varX' },
    { name: 'y', id: 'varY' },
  ],
})

/** The variable name a block's dropdown shows, without Blockly's ▾ arrow. */
async function variableShown(page: Page, blockId: string) {
  const text = await page
    .locator(`[data-id="${blockId}"] .blocklyDropdownText`)
    .first()
    .textContent()
  return (text ?? '').replace(/[\s ▾]+/g, '')
}

async function expectEveryUseShows(page: Page, name: string) {
  for (const id of USES) {
    await expect.poll(() => variableShown(page, id)).toBe(name)
  }
}

/** Opens a loose block's variable dropdown (the `x` one by default) and picks
 * `item`. */
async function pickFromLooseDropdown(page: Page, item: string, blockId = 'getLoose') {
  await page.locator(`[data-id="${blockId}"] .blocklyDropdownText`).first().click()
  const dropdown = page.locator('.blocklyDropDownDiv')
  await expect(dropdown).toBeVisible()
  await dropdown.locator('.blocklyMenuItem').getByText(item, { exact: true }).click()
}

async function expectCenteredAppDialog(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible()
  await expect(page.locator('dialog.blocklyDialog')).toHaveCount(0)
  // Settled: the dialog zooms in.
  await page.waitForTimeout(250)
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  if (!box || !viewport) throw new Error('the dialog or the viewport has no size')
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2)
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2)
}

test.describe('variable dialogs (#335)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Editor Dialogs'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    const key = workspaceStorageKey(participantId, problemId)
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [key, saved],
    )
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expectEveryUseShows(page, 'x')
  })

  test("'Renomear variável...' opens the app's dialog and refuses a bad name inside it", async ({
    page,
  }) => {
    await pickFromLooseDropdown(page, 'Renomear variável...')

    const dialog = page.getByTestId('rename-variable-dialog')
    await expectCenteredAppDialog(page, dialog)
    await expect(dialog).toContainText('Renomear a variável "x"')
    await expect(page.getByTestId('rename-variable-input')).toBeFocused()
    await expect(page.getByTestId('rename-variable-input')).toHaveValue('')
    await page.screenshot({ path: evidence('01-renomear-dialogo') })

    await page.getByTestId('rename-variable-confirm').click()
    await expect(page.getByTestId('rename-variable-error')).toHaveText('Dê um nome à variável.')
    await expect(dialog).toBeVisible()
    await page.screenshot({ path: evidence('02-renomear-vazio-recusado') })

    // Same type as `x`: Blockly would silently merge the two variables.
    await page.getByTestId('rename-variable-input').fill('y')
    await page.getByTestId('rename-variable-input').press('Enter')
    await expect(page.getByTestId('rename-variable-error')).toHaveText(
      'Já existe uma variável chamada "y".',
    )
    await expect(dialog).toBeVisible()
    await page.screenshot({ path: evidence('03-renomear-duplicado-recusado') })

    await page.getByTestId('rename-variable-cancel').click()
    await expect(dialog).toBeHidden()
    await expectEveryUseShows(page, 'x')
    await page.screenshot({ path: evidence('04-renomear-cancelado') })
  })

  test('a valid name renames every block that uses the variable', async ({ page }) => {
    await pickFromLooseDropdown(page, 'Renomear variável...')
    await page.getByTestId('rename-variable-input').fill('total')
    await page.getByTestId('rename-variable-confirm').click()

    await expect(page.getByTestId('rename-variable-dialog')).toBeHidden()
    await expectEveryUseShows(page, 'total')
    await page.screenshot({ path: evidence('05-renomeado') })
  })

  test('a case change of its own name is not a conflict, and renames (P2)', async ({ page }) => {
    await pickFromLooseDropdown(page, 'Renomear variável...')
    await page.getByTestId('rename-variable-input').fill('X')
    await page.getByTestId('rename-variable-confirm').click()

    await expect(page.getByTestId('rename-variable-dialog')).toBeHidden()
    await expect(page.getByTestId('rename-variable-error')).toHaveCount(0)
    await expectEveryUseShows(page, 'X')
    await page.screenshot({ path: evidence('05b-renomeado-so-caixa') })
  })

  test('a variable whose only use is the clicked block goes at once, with no dialog (P3)', async ({
    page,
  }) => {
    await pickFromLooseDropdown(page, "Deletar a variável 'y'", 'getY')

    await expect(page.locator('[data-id="getY"]')).toHaveCount(0)
    await expect(page.getByTestId('delete-variable-dialog')).toHaveCount(0)
    await expect(page.locator('dialog.blocklyDialog')).toHaveCount(0)
    await expectEveryUseShows(page, 'x')
    await page.locator('.blocklyToolbox').getByRole('treeitem', { name: 'Variáveis' }).click()
    const flyout = page.locator('.blocklyFlyout')
    await expect(flyout.getByText('x', { exact: true }).first()).toBeVisible()
    await expect(flyout.getByText('y', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: evidence('09-excluido-sem-dialogo') })
  })

  test('deleting a variable in use asks in the app first, and only deletes on confirm', async ({
    page,
  }) => {
    await pickFromLooseDropdown(page, "Deletar a variável 'x'")

    const dialog = page.getByTestId('delete-variable-dialog')
    await expectCenteredAppDialog(page, dialog)
    await expect(dialog).toContainText('Excluir a variável "x"?')
    await expect(dialog).toContainText('3 blocos usam essa variável')
    await page.screenshot({ path: evidence('06-excluir-dialogo') })

    await page.getByTestId('delete-variable-cancel').click()
    await expect(dialog).toBeHidden()
    await expectEveryUseShows(page, 'x')
    await page.screenshot({ path: evidence('07-excluir-cancelado') })

    await pickFromLooseDropdown(page, "Deletar a variável 'x'")
    await expect(dialog).toBeVisible()
    await page.getByTestId('delete-variable-confirm').click()

    await expect(dialog).toBeHidden()
    for (const id of USES) {
      await expect(page.locator(`[data-id="${id}"]`)).toHaveCount(0)
    }
    // The variable is gone from the flyout; `y` stays.
    await page.locator('.blocklyToolbox').getByRole('treeitem', { name: 'Variáveis' }).click()
    const flyout = page.locator('.blocklyFlyout')
    await expect(flyout.getByText('y', { exact: true }).first()).toBeVisible()
    await expect(flyout.getByText('x', { exact: true })).toHaveCount(0)
    await expect(page.locator('dialog.blocklyDialog')).toHaveCount(0)
    await page.screenshot({ path: evidence('08-excluido') })

    // One undo brings back the variable and every block it took: the delete
    // is a single event group. Close the flyout first, back on the canvas.
    await page.keyboard.press('Escape')
    await page.locator('.blocklyMainBackground').click({ position: { x: 700, y: 400 } })
    await page.keyboard.press('ControlOrMeta+z')
    await expectEveryUseShows(page, 'x')
    await page.screenshot({ path: evidence('08b-desfeito') })
  })
})

// #445 — the canvas menu's "Deletar N blocos" confirms in the app's dialog,
// not Blockly's `<dialog class="blocklyDialog">`. The saved workspace above
// has five deletable blocks — `setX`, `five` and `getReturn` inside the root,
// `getLoose` and `getY` on their own — and the root, which stays.
const DELETABLE = ['setX', 'five', 'getReturn', 'getLoose', 'getY'] as const
const evidence445 = (name: string) => `e2e/evidence/445/${name}.png`

async function expectBlocks(page: Page, ids: readonly string[], count: number) {
  for (const id of ids) {
    await expect(page.locator(`[data-id="${id}"]`)).toHaveCount(count)
  }
}

/** A point of the canvas with no block under it: bottom centre, clear of the
 * blocks (top of the view), the controls (right) and the scrollbar. */
async function emptyCanvasPoint(page: Page) {
  const box = await page.getByTestId('blockly-workspace').boundingBox()
  if (!box) throw new Error('the canvas has no size')
  return { x: box.x + box.width / 2, y: box.y + box.height - 40 }
}

test.describe('"Deletar N blocos" (#445)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Editor Delete All'))
  })

  test('asks in the app first, cancels cleanly, deletes all but the root on confirm', async ({
    page,
  }) => {
    // Any native dialog (window.confirm and friends) is a failure.
    const nativeDialogs: string[] = []
    page.on('dialog', (dialog) => {
      nativeDialogs.push(dialog.message())
      void dialog.dismiss()
    })
    await seedParticipantToken(page, participantToken)
    const key = workspaceStorageKey(participantId, problemId)
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [key, saved],
    )
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expectBlocks(page, ['kumiteSolveRoot', ...DELETABLE], 1)

    const menu = page.locator('.blocklyContextMenu')
    const dialog = page.getByTestId('delete-blocks-dialog')
    const chooseDeleteAll = async () => {
      const point = await emptyCanvasPoint(page)
      await page.mouse.click(point.x, point.y, { button: 'right' })
      await expect(menu).toBeVisible()
      await menu.getByText('Deletar 5 blocos', { exact: true }).click()
    }

    // 1 — the app's dialog, centred, with the count; no Blockly dialog.
    await chooseDeleteAll()
    await expectCenteredAppDialog(page, dialog)
    await expect(dialog).toContainText('Apagar 5 blocos?')
    await expect(dialog).toContainText('menos o "resolver"')
    await page.screenshot({ path: evidence445('01-dialogo') })

    // 2 — Cancel changes nothing.
    await page.getByTestId('delete-blocks-cancel').click()
    await expect(dialog).toBeHidden()
    await expectBlocks(page, ['kumiteSolveRoot', ...DELETABLE], 1)
    await page.screenshot({ path: evidence445('02-cancelado') })

    // 3 — Confirm deletes every deletable block; the root stays.
    await chooseDeleteAll()
    await expect(dialog).toBeVisible()
    await page.getByTestId('delete-blocks-confirm').click()
    await expect(dialog).toBeHidden()
    await expectBlocks(page, DELETABLE, 0)
    await expect(page.locator('[data-id="kumiteSolveRoot"]')).toHaveCount(1)
    await expect(page.locator('dialog.blocklyDialog')).toHaveCount(0)
    await page.screenshot({ path: evidence445('03-apagado') })

    // 4 — one undo brings all five back: a single event group.
    const point = await emptyCanvasPoint(page)
    await page.mouse.click(point.x, point.y)
    await page.keyboard.press('ControlOrMeta+z')
    await expectBlocks(page, ['kumiteSolveRoot', ...DELETABLE], 1)
    await page.screenshot({ path: evidence445('04-desfeito') })

    expect(nativeDialogs).toEqual([])
  })
})
