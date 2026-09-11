import { expect, type Page, test } from '@playwright/test'

import { ORGANIZER_NAME } from './support/rounds'

// The browser-side guards for #216 — everything the jsdom tests structurally
// cannot see: `index.html`'s anti-flash script (jsdom never runs it), whether a
// font actually loaded from our own origin, and whether the icons are really
// served. Doubles as the PR's visual evidence.
const evidence = (name: string) => `e2e/evidence/216/${name}.png`

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const hasOrganizerCredentials = Boolean(ORGANIZER_EMAIL && ORGANIZER_PASSWORD)

const PASSWORD = 'supersecret'
const stamp = Date.now().toString().slice(-6)

// The identity's surfaces, as `docs/design/tokens/tokens.css` declares them.
const PAPER = 'rgb(252, 250, 247)' // #fcfaf7
const INK_SURFACE = 'rgb(18, 15, 13)' // #120f0d
const CHROME_LIGHT = '#1c1716'
const CHROME_DARK = '#0e0c0b'

/** The header's own box, so the lockup fills the shot instead of a few pixels. */
async function headerClip(page: Page) {
  const box = await page.getByTestId('app-header').boundingBox()
  if (!box) throw new Error('the header has no box')
  return { x: box.x, y: box.y, width: box.width, height: box.height + 8 }
}

function backgroundOfBody(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

function themeColorMeta(page: Page): Promise<string | null> {
  return page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  )
}

test.describe('the default theme, with the OS asking for dark', () => {
  test.use({ colorScheme: 'dark' })

  // Acceptance: the default is light even on a dark system. `system` resolves
  // to light while the redesign epic (#214) is open — #234 is what turns
  // `prefers-color-scheme` back on, and this test is what will change with it.
  test('still paints paper, because nobody chose dark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-header')).toBeVisible()

    await expect(page.locator('html')).not.toHaveClass(/dark/)
    expect(await backgroundOfBody(page)).toBe(PAPER)
    expect(await themeColorMeta(page)).toBe(CHROME_LIGHT)

    await page.screenshot({ path: evidence('01-so-escuro-tela-clara'), fullPage: true })
    await page.screenshot({
      path: evidence('02-header-lockup-claro'),
      clip: await headerClip(page),
    })
  })
})

test.describe('a saved dark choice', () => {
  test.beforeEach(async ({ page }) => {
    // Runs before any script of the page, so the storage is already written
    // when `index.html`'s inline script reads it.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kumite:theme', 'dark')
      } catch {
        // nothing to do: the test below would fail loudly anyway
      }
    })
  })

  test('is on the <html> before the bundle runs, with no flash of paper', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Read at DOMContentLoaded: the inline script has run, the module bundle
    // has not finished. A class here can only have come from the anti-flash
    // script of `index.html` (T5), which is the whole point of duplicating the
    // storage key there.
    const classAtDomReady = await page.evaluate(() => document.documentElement.className)
    expect(classAtDomReady).toContain('dark')

    await expect(page.getByTestId('app-header')).toBeVisible()
    expect(await backgroundOfBody(page)).toBe(INK_SURFACE)
    // Rewritten by `applyTheme()` at boot: the browser chrome on mobile must
    // never claim a mode the screen is not showing.
    expect(await themeColorMeta(page)).toBe(CHROME_DARK)

    await page.screenshot({ path: evidence('03-escolha-escura'), fullPage: true })
    await page.screenshot({
      path: evidence('04-header-lockup-escuro'),
      clip: await headerClip(page),
    })
  })
})

test.describe('the fonts and the icons', () => {
  // Acceptance: the venue's network is not a dependency of the typography.
  test('serves every font from our own origin, never from Google', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        external.push(url)
      }
    })

    await page.goto('/')
    await expect(page.getByTestId('app-header')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    expect(external).toEqual([])
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      'Barlow',
    )
    // `fontFamily` only proves the CSS asks for Barlow; this proves it arrived.
    expect(await page.evaluate(() => document.fonts.check('400 16px Barlow'))).toBe(true)
  })

  test('answers 200 on both icons and names the tab kumite', async ({ page, request }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('kumite')
    for (const icon of ['/favicon.svg', '/apple-touch-icon.png']) {
      expect((await request.get(icon)).status(), icon).toBe(200)
    }
  })
})

test.describe('the destructive action, outlined', () => {
  test.skip(!hasOrganizerCredentials, 'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD')

  test('draws remove-team in crimson outline, not as a filled slab', async ({ page }) => {
    const email = `e2e-216-${stamp}@edu.pucrs.br`
    await fetch(`${BACK_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Identidade',
        email,
        password: PASSWORD,
        code: 'PUCRS2026',
      }),
    })
    const login = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    const { token } = (await login.json()) as { token: string }
    const created = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Identidade ${stamp}` }),
    })
    const { id: teamId } = (await created.json()) as { id: string }

    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    // Wait for the session to settle: navigating straight away races the route
    // guard, which bounces back to /login with nothing rendered.
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
    await page.goto('/organizer/teams')

    await expect(page.getByTestId(`team-moderation-card-${teamId}`)).toBeVisible()

    const remove = page.getByTestId(`team-moderation-remove-team-action-${teamId}`)
    await expect(remove).toBeVisible()

    const painted = await remove.evaluate((node) => {
      const style = getComputedStyle(node)
      return { background: style.backgroundColor, border: style.borderTopWidth }
    })
    // Transparent, in any of the shapes a browser reports it.
    expect(painted.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(painted.border).not.toBe('0px')

    await remove.scrollIntoViewIfNeeded()
    await page.screenshot({ path: evidence('05-destructive-contorno'), fullPage: true })
  })
})
