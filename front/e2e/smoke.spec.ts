import { expect, test } from '@playwright/test'

// Terraform smoke: the home page must render the API status fetched through the
// typed RPC client. The screenshot is the repo's first "verification walkthrough"
// evidence (see .claude/skills/reviewing-tasks).
//
// Scoped to the footer (#217): the home page's own `api-status` card still
// has an `api-status-ok` of its own until #222 removes it, and an unscoped
// `getByTestId` would match both, tripping Playwright's strict mode.
test('home shows the API status coming from the typed client', async ({ page }) => {
  await page.goto('/')
  const footerStatus = page.getByTestId('app-footer').getByTestId('api-status-ok')
  await expect(footerStatus).toBeVisible()
  await expect(footerStatus).toContainText('Conectado')
  await page.screenshot({ path: 'e2e/evidence/terraform-smoke.png', fullPage: true })
})
