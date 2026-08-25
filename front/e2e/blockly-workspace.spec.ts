import { expect, test } from '@playwright/test'

// Visual walkthrough for #2, one screenshot per acceptance criterion. It drives
// the temporary /sandbox/editor route, which goes away with #3.
const evidence = (name: string) => `e2e/evidence/2/${name}.png`

test('the Blockly wrapper mounts, round-trips and resizes in the browser', async ({ page }) => {
  const host = page.getByTestId('blockly-workspace')
  const svg = host.locator('svg.blocklySvg')
  const json = page.getByTestId('sandbox-json')
  const toolbox = page.locator('.blocklyToolbox')

  // 01 — mounts with the toolbox it got by prop.
  await page.goto('/sandbox/editor')
  await expect(svg).toBeVisible()
  await expect(toolbox.getByText('Lógica')).toBeVisible()
  await expect(toolbox.getByText('Números')).toBeVisible()
  await page.screenshot({ path: evidence('01-workspace-montado') })

  // 02 — deserialize() paints the blocks and onChange reports the new state.
  await page.getByTestId('sandbox-load-example').click()
  await expect(host.locator('g.blocklyDraggable').first()).toBeVisible()
  await expect(json).toContainText('controls_if')
  await expect(json).toContainText('math_number')
  await page.screenshot({ path: evidence('02-exemplo-carregado') })

  // 03 — a real drag out of the flyout fires onChange the same way.
  const before = await json.textContent()
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
  await expect(json).not.toHaveText(before ?? '')
  await page.screenshot({ path: evidence('03-bloco-arrastado') })

  // 04 — the workspace follows its container, so nothing is clipped.
  await page.setViewportSize({ width: 420, height: 800 })
  await expect
    .poll(async () => {
      const hostBox = await host.boundingBox()
      const svgBox = await svg.boundingBox()
      if (!hostBox || !svgBox) return Number.POSITIVE_INFINITY
      return Math.abs(svgBox.width - hostBox.width) + Math.abs(svgBox.height - hostBox.height)
    })
    .toBeLessThanOrEqual(2)
  await page.screenshot({ path: evidence('04-viewport-estreita') })
})
