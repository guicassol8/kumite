import { expect, test } from '@playwright/test'

// Visual walkthrough for #3, one screenshot per acceptance criterion.
const evidence = (name: string) => `e2e/evidence/3/${name}.png`

test('the problem screen lays out statement, examples and workspace, and hints on the disabled Submeter', async ({
  page,
}) => {
  const statementPanel = page.getByTestId('problem-statement-panel')
  const workspacePanel = page.getByTestId('problem-workspace-panel')
  const host = page.getByTestId('blockly-workspace')
  const svg = host.locator('svg.blocklySvg')

  // 01 — desktop: statement and workspace panels sit side by side, and the 3
  // example cases are visible with their input/expected text.
  await page.goto('/problem')
  await expect(statementPanel).toBeVisible()
  await expect(workspacePanel).toBeVisible()
  const statementBox = await statementPanel.boundingBox()
  const workspaceBox = await workspacePanel.boundingBox()
  if (!statementBox || !workspaceBox) throw new Error('the statement or workspace panel has no box')
  expect(statementBox.x + statementBox.width).toBeLessThanOrEqual(workspaceBox.x + 1)
  for (const index of [0, 1, 2]) {
    await expect(page.getByTestId(`problem-example-${index}`)).toBeVisible()
  }
  await expect(page.getByTestId('problem-example-0')).toContainText('[1,2,3,4]')
  await expect(page.getByTestId('problem-example-0')).toContainText('6')
  await page.screenshot({ path: evidence('01-layout-desktop') })

  // 02 — mobile: both panels stack vertically and the workspace still fills
  // its container without clipping (same resize proof as the wrapper's suite).
  await page.setViewportSize({ width: 420, height: 800 })
  const statementBoxMobile = await statementPanel.boundingBox()
  const workspaceBoxMobile = await workspacePanel.boundingBox()
  if (!statementBoxMobile || !workspaceBoxMobile) {
    throw new Error('the statement or workspace panel has no box on mobile')
  }
  expect(statementBoxMobile.y + statementBoxMobile.height).toBeLessThanOrEqual(
    workspaceBoxMobile.y + 1,
  )
  await expect
    .poll(async () => {
      const hostBox = await host.boundingBox()
      const svgBox = await svg.boundingBox()
      if (!hostBox || !svgBox) return Number.POSITIVE_INFINITY
      return Math.abs(svgBox.width - hostBox.width) + Math.abs(svgBox.height - hostBox.height)
    })
    .toBeLessThanOrEqual(2)
  await page.screenshot({ path: evidence('02-layout-mobile') })

  // 03 — hovering the disabled Submeter button shows the tooltip hint.
  await page.setViewportSize({ width: 1280, height: 800 })
  const submitButton = page.getByTestId('problem-submit-button')
  const hint = page.getByText('Disponível na competição')
  await submitButton.hover()
  await expect(hint).toBeVisible()
  await page.screenshot({ path: evidence('03-tooltip-hover') })

  // 04 — keyboard focus shows the same hint. Reload for a clean hover state
  // instead of chasing the tooltip's hover-away transition.
  await page.goto('/problem')
  await submitButton.focus()
  await expect(hint).toBeVisible()
  await page.screenshot({ path: evidence('04-tooltip-focus') })
})
