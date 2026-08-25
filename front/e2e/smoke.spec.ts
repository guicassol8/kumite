import { expect, test } from '@playwright/test'

// Terraform smoke: the home page must render the API status fetched through the
// typed RPC client. The screenshot is the repo's first "verification walkthrough"
// evidence (see .claude/skills/reviewing-tasks).
test('home shows the API status coming from the typed client', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('api-status-ok')).toBeVisible()
  await expect(page.getByTestId('api-status-ok')).toContainText('ok')
  await page.screenshot({ path: 'e2e/evidence/terraform-smoke.png', fullPage: true })
})
