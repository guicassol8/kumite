import { expect, test } from '@playwright/test'

// Visual evidence for #16: the curated toolbox and the root block are what the
// editor actually shows, in the browser, from @kumite/blocks.
const evidence = (name: string) => `e2e/evidence/16/${name}.png`

const categories = ['Lógica', 'Laços', 'Matemática', 'Texto', 'Listas', 'Variáveis']

test('the curated toolbox and the root block come from @kumite/blocks', async ({ page }) => {
  const host = page.getByTestId('blockly-workspace')
  const toolbox = page.locator('.blocklyToolbox')

  // 01 — the six curated categories, and only those.
  await page.goto('/problem')
  await expect(host.locator('svg.blocklySvg')).toBeVisible()
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
