import { expect, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// #205 — the editor opens with the solution centered in its viewport (not
// stuck in the top-left corner), has a "recentrar" control stacked on the zoom
// column, and "Criar variável..." opens the app's own dialog instead of
// Blockly's prompt.
const evidence = (name: string) => `e2e/evidence/205/${name}.png`

/** How far (px) "centered" may drift: grid snapping, the root's C shape. */
const CENTER_TOLERANCE = 24

// Top-level blocks of the main workspace only — the flyouts are separate svgs.
const TOP_BLOCKS = 'svg.blocklySvg .blocklyBlockCanvas > g.blocklyDraggable'

type Box = { x: number; y: number; width: number; height: number }

/** The canvas the participant actually sees: the workspace minus the toolbox. */
async function visibleCanvasCenter(page: Page) {
  const host = await page.getByTestId('blockly-workspace').boundingBox()
  const toolbox = await page.locator('.blocklyToolbox').boundingBox()
  if (!host || !toolbox) throw new Error('the workspace or its toolbox has no box')
  const left = toolbox.x + toolbox.width
  return { x: left + (host.x + host.width - left) / 2, y: host.y + host.height / 2 }
}

/** Center of the bounding box of every top-level block on the canvas. */
async function contentCenter(page: Page) {
  const boxes = await page.locator(TOP_BLOCKS).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
  if (boxes.length === 0) throw new Error('no block on the canvas')
  const left = Math.min(...boxes.map((b: Box) => b.x))
  const top = Math.min(...boxes.map((b: Box) => b.y))
  const right = Math.max(...boxes.map((b: Box) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b: Box) => b.y + b.height))
  return { x: (left + right) / 2, y: (top + bottom) / 2 }
}

async function expectCentered(page: Page) {
  await expect
    .poll(async () => {
      const [canvas, content] = await Promise.all([visibleCanvasCenter(page), contentCenter(page)])
      return Math.max(Math.abs(canvas.x - content.x), Math.abs(canvas.y - content.y))
    })
    .toBeLessThanOrEqual(CENTER_TOLERANCE)
}

/** The workspace zoom, read from the block canvas `scale(...)` transform. */
async function canvasScale(page: Page) {
  const transform = await page
    .locator('svg.blocklySvg .blocklyBlockCanvas')
    .first()
    .getAttribute('transform')
  const match = /scale\(([\d.]+)\)/.exec(transform ?? '')
  return match ? Number(match[1]) : 1
}

function translateOf(transform: string | null) {
  const match = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(transform ?? '')
  if (!match) throw new Error(`no translate in ${transform}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

async function openEditor(page: Page, problemId: string) {
  await page.goto(`/problem/${problemId}`)
  await expectBlocklyInjected(page)
  await expect(page.locator(TOP_BLOCKS).first()).toBeVisible()
}

async function openCreateVariable(page: Page, category = 'Variáveis', label = 'Criar variável...') {
  const flyout = page.locator('.blocklyFlyout')
  if (!(await flyout.getByText(label).isVisible())) {
    await page.locator('.blocklyToolbox').getByRole('treeitem', { name: category }).click()
  }
  await flyout.locator('.blocklyFlyoutButton').getByText(label).click()
  await expect(page.getByTestId('create-variable-dialog')).toBeVisible()
}

/** Variable names offered as `variables_get` blocks in the open flyout. */
function flyoutVariable(page: Page, name: string) {
  return page.locator('.blocklyFlyout').getByText(name, { exact: true })
}

test.describe('editor polish (#205)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Editor Polish'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('an empty workspace opens with the root block centered (AC1)', async ({ page }) => {
    await openEditor(page, problemId)

    await expect(page.locator(TOP_BLOCKS)).toHaveCount(1)
    await expectCentered(page)
    await page.screenshot({ path: evidence('01-vazio-centralizado') })
  })

  test('a restored autosave keeps its block positions and centers the view (AC2)', async ({
    page,
  }) => {
    const key = workspaceStorageKey(participantId, problemId)
    const saved = JSON.stringify({
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'kumite_solve', id: 'kumiteSolveRoot', x: 40, y: 40, deletable: false },
          { type: 'math_number', id: 'numA', x: 100, y: 300, fields: { NUM: 1 } },
          { type: 'math_number', id: 'numB', x: 700, y: 420, fields: { NUM: 2 } },
        ],
      },
    })
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [key, saved],
    )
    // addInitScript runs before the app on every navigation; read what the
    // app left in storage *after* it loaded and settled.
    await openEditor(page, problemId)
    await expect(page.locator(TOP_BLOCKS)).toHaveCount(3)
    await expectCentered(page)

    // The positions are the participant's: the saved state is untouched
    // byte for byte, and the blocks keep their distance on screen.
    await page.waitForTimeout(500)
    expect(await page.evaluate((k) => window.localStorage.getItem(k), key)).toBe(saved)
    const scale = await canvasScale(page)
    const a = await page.locator('[data-id="numA"]').boundingBox()
    const b = await page.locator('[data-id="numB"]').boundingBox()
    if (!a || !b) throw new Error('the restored blocks have no box')
    expect(Math.abs(b.x - a.x - 600 * scale)).toBeLessThanOrEqual(1)
    expect(Math.abs(b.y - a.y - 120 * scale)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: evidence('02-autosave-centralizado') })
  })

  test('the recenter control brings a lost solution back, keeping the zoom (AC3)', async ({
    page,
  }) => {
    await openEditor(page, problemId)
    await expectCentered(page)
    const scale = await canvasScale(page)

    // The control sits in the zoom column, right above it. Compared through
    // their `translate(...)`: both live in the same svg space, while the zoom
    // buttons' client rects are their whole (clipped) sprite sheet.
    const recenter = page.getByTestId('editor-recenter')
    await expect(recenter).toBeVisible()
    await expect(recenter).toHaveAttribute('aria-label', 'Centralizar a solução')
    const zoomColumn = translateOf(
      await page
        .locator('.blocklyZoomReset')
        .evaluate((node) => node.parentElement?.getAttribute('transform') ?? null),
    )
    const button = translateOf(await recenter.getAttribute('transform'))
    expect(button.x).toBe(zoomColumn.x)
    expect(button.y + 32).toBeLessThan(zoomColumn.y)

    // Drag the canvas background far away.
    const canvas = await visibleCanvasCenter(page)
    const host = await page.getByTestId('blockly-workspace').boundingBox()
    if (!host) throw new Error('the workspace has no box')
    const grab = { x: host.x + host.width - 140, y: host.y + 60 }
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x - 250, grab.y + 250, { steps: 10 })
    await page.mouse.up()
    const lost = await contentCenter(page)
    expect(Math.abs(lost.x - canvas.x) + Math.abs(lost.y - canvas.y)).toBeGreaterThan(200)
    await page.screenshot({ path: evidence('03-perdido') })

    await recenter.click()
    await expectCentered(page)
    expect(await canvasScale(page)).toBe(scale)
    await page.screenshot({ path: evidence('04-recentralizado') })
  })

  test("'Criar variável...' opens the app's dialog, centered, not Blockly's (AC4)", async ({
    page,
  }) => {
    await openEditor(page, problemId)
    await openCreateVariable(page)

    const dialog = page.getByTestId('create-variable-dialog')
    const box = await dialog.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('the dialog or the viewport has no size')
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2)
    await expect(page.getByTestId('create-variable-input')).toBeFocused()
    await expect(page.locator('dialog.blocklyDialog')).toHaveCount(0)
    // Nothing of Blockly paints over the dialog: its top-left corner, which
    // overlaps the toolbox column, hits the dialog itself.
    const onTop = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid'),
      { x: box.x + 4, y: box.y + box.height / 2 },
    )
    expect(onTop).toBe('create-variable-dialog')
    await page.screenshot({ path: evidence('05-dialogo') })
  })

  test('an empty or duplicate name is refused inside the dialog (AC5)', async ({ page }) => {
    await openEditor(page, problemId)
    await openCreateVariable(page)

    await page.getByTestId('create-variable-confirm').click()
    await expect(page.getByTestId('create-variable-error')).toHaveText('Dê um nome à variável.')
    await expect(page.getByTestId('create-variable-dialog')).toBeVisible()
    await page.screenshot({ path: evidence('06-vazio-recusado') })

    await page.getByTestId('create-variable-input').fill('soma')
    await page.getByTestId('create-variable-input').press('Enter')
    await expect(page.getByTestId('create-variable-dialog')).toBeHidden()
    // One variable shows up in several flyout blocks (set, get...): what
    // matters is that the refused duplicate adds none.
    await expect(flyoutVariable(page, 'soma').first()).toBeVisible()
    const somaBlocks = await flyoutVariable(page, 'soma').count()

    await openCreateVariable(page)
    await page.getByTestId('create-variable-input').fill('Soma')
    await page.getByTestId('create-variable-confirm').click()
    await expect(page.getByTestId('create-variable-error')).toHaveText(
      'Já existe uma variável chamada "soma".',
    )
    await expect(page.getByTestId('create-variable-dialog')).toBeVisible()
    await page.screenshot({ path: evidence('07-duplicado-recusado') })

    await page.getByTestId('create-variable-cancel').click()
    await expect(page.getByTestId('create-variable-dialog')).toBeHidden()
    await expect(flyoutVariable(page, 'soma')).toHaveCount(somaBlocks)
    await expect(flyoutVariable(page, 'Soma')).toHaveCount(0)
  })

  test('cancelling creates nothing, by button or by Escape (AC6)', async ({ page }) => {
    await openEditor(page, problemId)
    await openCreateVariable(page)
    await page.getByTestId('create-variable-input').fill('descartada')
    await page.getByTestId('create-variable-cancel').click()
    await expect(page.getByTestId('create-variable-dialog')).toBeHidden()

    await openCreateVariable(page)
    await page.getByTestId('create-variable-input').fill('outra')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('create-variable-dialog')).toBeHidden()

    await expect(flyoutVariable(page, 'descartada')).toHaveCount(0)
    await expect(flyoutVariable(page, 'outra')).toHaveCount(0)
    await page.screenshot({ path: evidence('08-cancelado') })
  })

  test('"Limpar" recenters, also with the statement collapsed (#203)', async ({ page }) => {
    await openEditor(page, problemId)
    await page.getByTestId('problem-statement-collapse').click()
    await expect(page.getByTestId('problem-statement-rail')).toBeVisible()
    // The wider editor still has the control inside it.
    const recenter = page.getByTestId('editor-recenter')
    await expect(recenter).toBeInViewport({ ratio: 1 })

    const host = await page.getByTestId('blockly-workspace').boundingBox()
    if (!host) throw new Error('the workspace has no box')
    const grab = { x: host.x + host.width - 140, y: host.y + 60 }
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x - 300, grab.y + 250, { steps: 10 })
    await page.mouse.up()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('problem-clear-button').click()
    await expect(page.locator(TOP_BLOCKS)).toHaveCount(1)
    await expectCentered(page)
    await page.screenshot({ path: evidence('11-limpar-centralizado') })
  })

  test("Blockly's context menu and field dropdown still paint above the editor", async ({
    page,
  }) => {
    // The editor box is `isolate` so Blockly's toolbox stays under the app's
    // dialogs; Blockly's menus live on <body> and must stay on top.
    await openEditor(page, problemId)
    const onTopOf = (selector: string, x: number, y: number) =>
      page.evaluate(
        ([s, px, py]) =>
          !!document.elementFromPoint(px as number, py as number)?.closest(s as string),
        [selector, x, y],
      )

    await openCreateVariable(page)
    await page.getByTestId('create-variable-input').fill('abc')
    await page.getByTestId('create-variable-input').press('Enter')
    await expect(page.getByTestId('create-variable-dialog')).toBeHidden()
    // The flyout stays open after the dialog gives focus back.
    await expect(flyoutVariable(page, 'abc').first()).toBeVisible()

    // Drag a variable block from the flyout onto the canvas.
    const before = await page.locator(TOP_BLOCKS).count()
    const source = page
      .locator('.blocklyFlyout .blocklyDraggable')
      .filter({ hasText: 'abc' })
      .last()
    const from = await source.boundingBox()
    const host = await page.getByTestId('blockly-workspace').boundingBox()
    if (!from || !host) throw new Error('the flyout block or the workspace has no box')
    await page.mouse.move(from.x + 8, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(host.x + host.width - 200, host.y + host.height - 80, { steps: 12 })
    await page.mouse.up()
    await expect(page.locator(TOP_BLOCKS)).toHaveCount(before + 1)

    // Its variable dropdown (Blockly's DropDownDiv) is on top.
    await page.locator(TOP_BLOCKS).last().locator('.blocklyDropdownText').click()
    const dropdown = page.locator('.blocklyDropDownDiv')
    await expect(dropdown).toBeVisible()
    const menu = await dropdown.boundingBox()
    if (!menu) throw new Error('the dropdown has no box')
    expect(
      await onTopOf('.blocklyDropDownDiv', menu.x + menu.width / 2, menu.y + menu.height / 2),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dropdown).toBeHidden()

    // The canvas context menu (Blockly's WidgetDiv) is on top too.
    await page.mouse.click(host.x + host.width - 360, host.y + 40, { button: 'right' })
    const context = page.locator('.blocklyContextMenu')
    await expect(context).toBeVisible()
    const box = await context.boundingBox()
    if (!box) throw new Error('the context menu has no box')
    expect(await onTopOf('.blocklyContextMenu', box.x + 10, box.y + 10)).toBe(true)
    await page.screenshot({ path: evidence('12-menus-acima') })
  })

  test.describe('in English, dark theme', () => {
    test.use({ colorScheme: 'dark' })

    test('the dialog follows the language and the theme', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('kumite-lang', 'en')
        window.localStorage.setItem('kumite:theme', 'dark')
      })
      await openEditor(page, problemId)
      await expect(page.getByTestId('editor-recenter')).toHaveAttribute(
        'aria-label',
        'Center the solution',
      )
      await openCreateVariable(page, 'Variables', 'Create variable...')
      await page.getByTestId('create-variable-confirm').click()
      await expect(page.getByTestId('create-variable-error')).toHaveText(
        'Give the variable a name.',
      )
      await page.screenshot({ path: evidence('09-dialogo-en-escuro') })
    })
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('the root opens centered and the recenter control is on screen', async ({ page }) => {
      await openEditor(page, problemId)
      await expectCentered(page)
      // The stacked editor is too short for a fourth button above the zoom
      // column, so the control sits beside it — but inside the editor.
      const recenter = page.getByTestId('editor-recenter')
      await expect(recenter).toBeInViewport({ ratio: 1 })
      const button = await recenter.boundingBox()
      const host = await page.getByTestId('blockly-workspace').boundingBox()
      if (!button || !host) throw new Error('the recenter control or the editor has no box')
      expect(button.y).toBeGreaterThanOrEqual(host.y)
      expect(button.y + button.height).toBeLessThanOrEqual(host.y + host.height)

      await recenter.click()
      await expectCentered(page)
      await page.screenshot({ path: evidence('10-celular') })
    })
  })
})
