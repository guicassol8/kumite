import { expect, test } from '@playwright/test'

// Visual walkthrough for #6, one screenshot per acceptance criterion.
const evidence = (name: string) => `e2e/evidence/6/${name}.png`

async function dragBlockFromFlyout(page: import('@playwright/test').Page) {
  const host = page.getByTestId('blockly-workspace')
  const toolbox = page.locator('.blocklyToolbox')
  await toolbox.getByRole('treeitem', { name: 'Números' }).click()
  const flyoutBlock = page.locator('.blocklyFlyout g.blocklyDraggable').first()
  await expect(flyoutBlock).toBeVisible()
  const source = await flyoutBlock.boundingBox()
  const canvas = await host.boundingBox()
  if (!source || !canvas) throw new Error('the flyout block or the canvas has no box')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.6, {
    steps: 12,
  })
  await page.mouse.up()
}

test('the workspace auto-saves per problem, restores on reopen, and Limpar blocos resets it', async ({
  page,
}) => {
  const host = page.getByTestId('blockly-workspace')
  const draggedBlock = host.locator('g.blocklyDraggable:visible').first()

  // 01 — a dragged block survives a reload of the same screen (auto-saved,
  // debounced, then read back).
  await page.goto('/problem')
  await dragBlockFromFlyout(page)
  await expect(draggedBlock).toBeVisible()
  await page.waitForTimeout(600)
  await page.reload()
  await expect(host.locator('g.blocklyDraggable:visible').first()).toBeVisible()
  await page.screenshot({ path: evidence('01-persisted-across-reload') })

  // 02 — navigating away and back restores the same saved blocks.
  await page.goto('/')
  await page.goto('/problem')
  await expect(host.locator('g.blocklyDraggable:visible').first()).toBeVisible()
  await page.screenshot({ path: evidence('02-restored-on-reopen') })

  // 03 — confirming "Limpar blocos" empties the workspace and removes the
  // saved state, so it stays empty after a reload too.
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('problem-clear-button').click()
  await expect(host.locator('g.blocklyDraggable:visible')).toHaveCount(0)
  await page.reload()
  await expect(host.locator('g.blocklyDraggable:visible')).toHaveCount(0)
  await page.screenshot({ path: evidence('03-cleared-and-stays-empty') })
})

test('the workspace still mounts and accepts blocks when localStorage is unavailable', async ({
  page,
}) => {
  const host = page.getByTestId('blockly-workspace')

  // 04 — localStorage throwing on every access must not crash the screen:
  // it mounts and still accepts a dragged block, just without persistence.
  await page.addInitScript(() => {
    const throwUnavailable = () => {
      throw new Error('localStorage unavailable')
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: throwUnavailable,
    })
  })
  await page.goto('/problem')
  await expect(host.locator('svg.blocklySvg')).toBeVisible()
  await dragBlockFromFlyout(page)
  await expect(host.locator('g.blocklyDraggable:visible').first()).toBeVisible()
  await page.screenshot({ path: evidence('04-localstorage-unavailable') })
})
