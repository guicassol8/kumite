import { expect, test } from '@playwright/test'

// #134: the collectors are mounted in the root layout, so the one thing a
// browser can prove is the guard around them — a dev build must never talk to
// Vercel, on the first load or on any client-side navigation.
const ANALYTICS_HOSTS = [
  'va.vercel-scripts.com',
  'vitals.vercel-insights.com',
  '/_vercel/insights',
  '/_vercel/speed-insights',
]

const isAnalyticsRequest = (url: string) => ANALYTICS_HOSTS.some((needle) => url.includes(needle))

test('a dev build sends nothing to Vercel analytics (#134)', async ({ page }) => {
  const analyticsRequests: string[] = []
  page.on('request', (request) => {
    if (isAnalyticsRequest(request.url())) analyticsRequests.push(request.url())
  })

  await page.goto('/')
  await expect(page.getByTestId('app-header')).toBeVisible()
  await page.screenshot({ path: 'e2e/evidence/134/01-home-no-analytics.png', fullPage: true })

  // Client-side routing, not a reload: this is the navigation that would emit a
  // pageview if the production guard were missing.
  await page.getByTestId('header-login-link').click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByTestId('header-signup-link').click()
  await expect(page).toHaveURL(/\/signup$/)

  await page.goto('/leaderboard')
  await expect(page.getByTestId('app-header')).toBeVisible()
  await page.screenshot({
    path: 'e2e/evidence/134/02-leaderboard-no-analytics.png',
    fullPage: true,
  })

  expect(analyticsRequests).toEqual([])
})
