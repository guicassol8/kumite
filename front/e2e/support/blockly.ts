import { expect, type Page } from '@playwright/test'

// Drag helpers shared by the specs that build a solution on the canvas.
// The category label is a parameter because the toolbox is translated
// ("Matemática" in pt, "Matemáticas" in es, "Math" in en) — a hardcoded label
// would tie the helper to a single UI language.
//
// Playwright only collects `*.spec.ts` under `testDir`, so this file is a
// helper, not a suite.

/** Opens `category` in the toolbox and drags its first block onto the canvas. */
export async function dragBlockFromFlyout(page: Page, category: string): Promise<void> {
  const host = page.getByTestId('blockly-workspace')
  const toolbox = page.locator('.blocklyToolbox')
  await toolbox.getByRole('treeitem', { name: category }).click()
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
