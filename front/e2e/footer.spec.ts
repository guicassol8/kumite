import { expect, test } from '@playwright/test'

// The footer is the event's only contact channel, so these specs cover what the
// component test cannot: that it survives real routing and that it actually
// lands at the bottom of a short page instead of floating over the content.
test.describe('global footer', () => {
  test('is visible on the home route for an anonymous visitor', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
    await expect(page.getByTestId('footer-contact-email')).toHaveText('ligadealgoritmos@gmail.com')
  })

  test('is visible on /login, where the visitor has no session', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
  })

  // Acceptance: "WHEN a página tem conteúdo mais curto que a viewport THE
  // SYSTEM SHALL manter o footer no rodapé, sem sobrepor o conteúdo."
  test('sits at the bottom of a short page without overlapping the content', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('app-footer')).toBeVisible()

    const viewport = page.viewportSize()
    if (!viewport) throw new Error('expected a fixed viewport for this assertion')

    const footerBox = await page.getByTestId('app-footer').boundingBox()
    const mainBox = await page.locator('main').first().boundingBox()
    if (!footerBox || !mainBox) throw new Error('expected footer and main to be laid out')

    // Fully inside the viewport: no scrolling needed to reach the contact.
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height)
    // Below the content, never on top of it.
    expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height)
  })
})
