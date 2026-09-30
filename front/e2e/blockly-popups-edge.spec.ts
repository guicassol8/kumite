import { expect, type Locator, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// #367: Blockly ≥ 12 hung its context menu and field dropdowns inside the
// canvas's `.injectionDiv` (overflow: hidden) while positioning them against
// the window, so a menu that fit the window below a block near the bottom of
// the canvas was drawn there and cut at the canvas edge. `toBeInViewport`
// measures with an IntersectionObserver, which clips by every ancestor's
// overflow — exactly what cut the menu — so it fails where the menu is cut
// and passes where it is whole.
const evidence = (name: string) => `e2e/evidence/367/${name}.png`

const VIEWPORT = { width: 1280, height: 720 }

// Top-level blocks of the main workspace only — the flyouts are separate svgs.
const TOP_BLOCKS = 'svg.blocklySvg .blocklyBlockCanvas > g.blocklyDraggable'

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('expected the element to be laid out')
  return box
}

/** Drags the flyout block matching `block` from `category` to (x, y). */
async function dropFromFlyout(page: Page, category: string, block: Locator, x: number, y: number) {
  await page.locator('.blocklyToolbox').getByRole('treeitem', { name: category }).click()
  await expect(block).toBeVisible()
  const from = await boxOf(block)
  await page.mouse.move(from.x + 6, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 12 })
  await page.mouse.up()
}

/** Moves a block already on the canvas so that its top-left corner lands on (x, y). */
async function moveBlock(page: Page, block: Locator, x: number, y: number) {
  const from = await boxOf(block)
  await page.mouse.move(from.x + 6, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(x + 6, y + from.height / 2, { steps: 12 })
  await page.mouse.up()
}

/** Every item of an open menu, the last one included, whole on screen. */
async function expectEveryItemWhole(items: Locator) {
  const count = await items.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index++) {
    await expect(items.nth(index)).toBeInViewport({ ratio: 1 })
  }
}

test.describe('Blockly popups near the bottom edge of the canvas (#367)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    // A closed round, with its one-line notice above the canvas — the layout
    // the issue was found on.
    ;({ problemId, participantToken } = await seedEditorFixture('Blockly Popups Edge'))
  })

  // No saved workspace: the lone root block sits in the middle of the canvas,
  // and every block below is dropped well to its right, where it cannot snap
  // into one of its inputs and stop being a top-level block.
  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    await page.setViewportSize(VIEWPORT)
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
  })

  test('the context menu of a block near the bottom shows every item', async ({ page }) => {
    const canvas = await boxOf(page.getByTestId('blockly-workspace'))
    const canvasBottom = canvas.y + canvas.height
    const menu = page.locator('.blocklyContextMenu')

    // A plain block, dropped high on the canvas first: that is where its menu
    // opens whole whatever the fix, so it gives the menu's real height.
    const blocksBefore = await page.locator(TOP_BLOCKS).count()
    await dropFromFlyout(
      page,
      'Matemática',
      page.locator('.blocklyFlyout g.blocklyDraggable').first(),
      canvas.x + canvas.width * 0.72,
      canvas.y + 60,
    )
    await expect(page.locator(TOP_BLOCKS)).toHaveCount(blocksBefore + 1)
    const block = page.locator(TOP_BLOCKS).last()
    const high = await boxOf(block)
    await page.mouse.click(high.x + 6, high.y + high.height / 2, { button: 'right' })
    await expect(menu).toBeVisible()
    const menuHeight = (await boxOf(menu)).height
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    // Then moved so the right-click lands where the menu still fits the
    // window below the click (so Blockly draws it there) but not the canvas
    // (so the canvas edge would cut it): canvasBottom < y + h < 720.
    const clickY = canvasBottom - menuHeight + (VIEWPORT.height - canvasBottom) / 2
    await moveBlock(page, block, canvas.x + canvas.width * 0.72, clickY - high.height / 2)
    const low = await boxOf(block)
    const y = Math.min(Math.max(clickY, low.y + 3), low.y + low.height - 3)
    await page.mouse.click(low.x + 6, y, { button: 'right' })
    await expect(menu).toBeVisible()

    // The test only proves something if the menu really crosses the canvas
    // edge while fitting the window.
    const opened = await boxOf(menu)
    expect(opened.y).toBeGreaterThanOrEqual(y - 2)
    expect(opened.y + opened.height).toBeGreaterThan(canvasBottom + 1)
    expect(opened.y + opened.height).toBeLessThanOrEqual(VIEWPORT.height)

    await expectEveryItemWhole(menu.locator('.blocklyMenuItem'))
    await expect(page.locator('.injectionDiv .blocklyWidgetDiv')).toHaveCount(0)
    await page.screenshot({ path: evidence('01-menu-contexto-borda') })
  })

  test('a field dropdown near the bottom shows every option', async ({ page }) => {
    // The results band takes its share of the column first, and the canvas
    // goes down to its floor: a dropdown only leaves the canvas when it fits
    // neither below nor above the field inside it.
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-panel')).toBeVisible()
    const handle = await boxOf(page.getByTestId('problem-results-handle'))
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 2000, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(200)

    const canvas = await boxOf(page.getByTestId('blockly-workspace'))
    const canvasBottom = canvas.y + canvas.height
    const flyoutCompare = page
      .locator('.blocklyFlyout g.blocklyDraggable')
      .filter({ has: page.locator('.blocklyDropdownText', { hasText: '=' }) })
      .first()
    const blocksBefore = await page.locator(TOP_BLOCKS).count()
    await dropFromFlyout(
      page,
      'Lógica',
      flyoutCompare,
      canvas.x + canvas.width * 0.72,
      canvas.y + canvas.height * 0.5,
    )
    await expect(page.locator(TOP_BLOCKS)).toHaveCount(blocksBefore + 1)

    const field = page.locator(TOP_BLOCKS).last().locator('.blocklyDropdownText')
    const fieldBox = await boxOf(field)
    await field.click()
    const dropdown = page.locator('.blocklyDropDownDiv')
    await expect(dropdown).toBeVisible()
    const items = dropdown.locator('.blocklyMenuItem')
    await expect(items.first()).toBeVisible()
    // Settled: the dropdown slides in with a transform transition.
    await page.waitForTimeout(300)
    const opened = await boxOf(dropdown)

    // Whether this step can fail at all: the dropdown only leaves the canvas
    // when it fits neither below nor above the field inside it. When it
    // does, it must cross the canvas edge and still be whole.
    const fitsBelowInside = fieldBox.y + fieldBox.height + opened.height < canvasBottom
    const fitsAboveInside = fieldBox.y - opened.height > canvas.y
    test.info().annotations.push({
      type: 'geometry',
      description: `canvas ${Math.round(canvas.y)}–${Math.round(canvasBottom)}, dropdown ${Math.round(opened.y)}–${Math.round(opened.y + opened.height)}, fits inside below=${fitsBelowInside} above=${fitsAboveInside}`,
    })
    if (!fitsBelowInside && !fitsAboveInside) {
      expect(opened.y + opened.height).toBeGreaterThan(canvasBottom + 1)
    }

    await expectEveryItemWhole(items)
    await expect(page.locator('.injectionDiv .blocklyDropDownDiv')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-dropdown-borda') })
  })
})
