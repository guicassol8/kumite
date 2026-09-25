import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { ORGANIZER_NAME } from './support/rounds'

// #273: the back answers Access-Control-Allow-Origin only to APP_BASE_URL and
// the local dev front. These run in a real browser, so they prove what the
// back's unit tests cannot: the SPA still reaches the API cross-origin, and a
// page on any other origin is actually blocked by the browser.
const evidence = (name: string) => `e2e/evidence/273/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const API = `http://localhost:${process.env.PORT ?? '3000'}`

test.describe('CORS allowlist from the front origin', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('the front logs in cross-origin and the API echoes its origin', async ({ page }) => {
    await page.goto('/login')
    const frontOrigin = new URL(page.url()).origin
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.screenshot({ path: evidence('01-login-filled'), fullPage: true })

    const login = page.waitForResponse(
      (res) => res.url() === `${API}/auth/login` && res.request().method() === 'POST',
    )
    await page.getByTestId('login-submit-button').click()
    const res = await login
    expect(res.status()).toBe(200)
    expect(res.headers()['access-control-allow-origin']).toBe(frontOrigin)
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
    await page.screenshot({ path: evidence('02-logged-in-cross-origin'), fullPage: true })

    // An authenticated call carries Authorization, so it needs a preflight:
    // the overview's numbers loading proves the preflight is allowed too.
    await page.goto('/organizer')
    await expect(page.getByTestId('organizer-heading')).toBeVisible()
    await expect(page.getByTestId('overview-signups-total')).toBeVisible()
    await expect(page.getByTestId('overview-error')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-organizer-panel-authenticated'), fullPage: true })
  })
})

test.describe('a page on another origin', () => {
  // A real loopback server, like the front's own dev server: Chromium blocks a
  // page with no real address (page.route) from calling loopback on its own,
  // whatever the CORS headers say. Served from here, only the back's CORS
  // allowlist tells this origin apart from the front's.
  let server: Server
  let otherOrigin = ''

  test.beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<!doctype html><title>other origin</title><h1 id="out">pending</h1>')
    })
    await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve))
    otherOrigin = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  test('cannot read the API', async ({ page }) => {
    await page.goto(`${otherOrigin}/`)

    const outcome = await page.evaluate(async (api) => {
      try {
        const res = await fetch(`${api}/health`)
        return `read ${res.status}`
      } catch (err) {
        return `blocked: ${(err as Error).name}`
      }
    }, API)
    await page.evaluate((text) => {
      const out = document.getElementById('out')
      if (out) out.textContent = `fetch ${text} from ${location.origin}`
    }, `${API}/health -> ${outcome}`)

    expect(outcome).toBe('blocked: TypeError')
    await page.screenshot({ path: evidence('04-other-origin-blocked'), fullPage: true })
  })
})
