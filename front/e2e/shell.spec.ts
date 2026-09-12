import { expect, test } from '@playwright/test'

// The two global shells and the sharing metadata (#230). None of the screens
// here are guarded, so no login is needed for any of it.
const evidence = (name: string) => `e2e/evidence/230/${name}.png`

/** IHDR is the PNG format's first chunk: bytes 16-19 width, 20-23 height. */
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

test.describe('404 — NotFoundScreen', () => {
  test('renders the card for an unknown URL, in Portuguese, with header and footer', async ({
    page,
  }) => {
    // 01 — an unknown URL gets the branded 404, not the router's blank default.
    await page.goto('/rota-que-nao-existe')

    await expect(page.getByTestId('not-found-card')).toBeVisible()
    await expect(page.getByText('Página não encontrada')).toBeVisible()
    await expect(page.getByTestId('app-header')).toBeVisible()
    await expect(page.getByTestId('app-footer')).toBeVisible()
    await page.screenshot({ path: evidence('01-404-pt'), fullPage: true })
  })

  test('translates into the active language and updates <html lang>', async ({ page }) => {
    // 02 — switching language on the 404 itself: text and <html lang> both move.
    await page.goto('/rota-que-nao-existe')
    await page.getByTestId('language-option-es').click()

    await expect(page.getByText('Página no encontrada')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await page.screenshot({ path: evidence('02-404-es-e-lang'), fullPage: true })
  })

  test('sends the visitor home through the link', async ({ page }) => {
    // 03 — the way back: a real navigation to the home screen.
    await page.goto('/rota-que-nao-existe')

    await page.getByTestId('not-found-home-link').click()

    await expect(page).toHaveURL(/\/$/)
    await page.screenshot({ path: evidence('03-volta-para-a-home'), fullPage: true })
  })
})

test.describe('render error — RouteErrorScreen', () => {
  test('renders the card with no stack trace, via the permanent probe route', async ({ page }) => {
    // 04 — /dev/error-probe throws on every render in dev; nothing about the
    // error may leak into the page (Acceptance: "sem expor stack trace").
    await page.goto('/dev/error-probe')

    await expect(page.getByTestId('route-error-card')).toBeVisible()
    const body = await page.textContent('body')
    expect(body).not.toContain('sonda de erro de render')
    expect(body).not.toContain('at ')
    await page.screenshot({ path: evidence('04-tela-de-erro'), fullPage: true })
  })

  test('offers a way out through the home link', async ({ page }) => {
    // 05 — the retry button re-mounts the probe, which throws again by
    // construction; the assertion here is that the exit route works.
    await page.goto('/dev/error-probe')

    await expect(page.getByTestId('route-error-retry')).toBeEnabled()
    await page.getByTestId('route-error-home-link').click()

    await expect(page).toHaveURL(/\/$/)
    await page.screenshot({ path: evidence('05-erro-saida'), fullPage: true })
  })
})

test.describe('manifest and icons', () => {
  test('serves manifest.webmanifest with the app icons and theme_color', async ({ request }) => {
    // 06 — the PWA contract: standalone, one theme_color, three icon sizes,
    // and the og-card at the exact size a link-preview crawler expects.
    const manifestRes = await request.get('/manifest.webmanifest')
    expect(manifestRes.status()).toBe(200)
    const manifest = await manifestRes.json()
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#1C1716')
    expect(manifest.icons).toHaveLength(3)

    for (const icon of manifest.icons) {
      const res = await request.get(icon.src)
      expect(res.status()).toBe(200)
    }

    const ogRes = await request.get('/og-card.png')
    expect(ogRes.status()).toBe(200)
    expect(pngDimensions(await ogRes.body())).toEqual({ width: 1200, height: 630 })
  })
})

test.describe('sharing metadata', () => {
  test('exposes an absolute og:image and twitter:card on the home page', async ({ page }) => {
    // 07 — what a WhatsApp/Slack/Instagram preview reads.
    await page.goto('/')

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content')
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')

    expect(ogTitle).toBeTruthy()
    expect(ogDescription).toBeTruthy()
    expect(ogImage).toMatch(/^https:\/\//)
    expect(ogImage).toMatch(/\/og-card\.png$/)
    expect(twitterCard).toBe('summary_large_image')

    // The card itself, open directly — the piece a reviewer actually needs to see.
    await page.goto('/og-card.png')
    await page.screenshot({ path: evidence('06-metadados-og') })
  })
})
