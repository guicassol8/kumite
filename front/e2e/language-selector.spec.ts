import { expect, test } from '@playwright/test'

// Visual walkthrough for #56, one screenshot per acceptance criterion.
const evidence = (name: string) => `e2e/evidence/56/${name}.png`

test.describe('browser detected as Spanish (es-MX)', () => {
  test.use({ locale: 'es-MX' })

  test('opens the UI in Spanish on a first visit', async ({ page }) => {
    // 01 — a first-time es-MX visitor sees the UI in Spanish, with the
    // selector marking Spanish as the active language.
    await page.goto('/')
    await expect(page.getByTestId('language-option-es')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByText('PUCRS × Mérida — programación con bloques')).toBeVisible()
    await page.screenshot({ path: evidence('01-es-mx-browser-opens-in-spanish'), fullPage: true })
  })

  test('still detects Spanish when localStorage is unavailable', async ({ page }) => {
    // 04 — localStorage throwing on every access must not break detection:
    // it still resolves the language from the browser.
    await page.addInitScript(() => {
      const throwUnavailable = () => {
        throw new Error('localStorage unavailable')
      }
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: throwUnavailable,
      })
    })
    await page.goto('/')
    await expect(page.getByTestId('language-option-es')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByText('PUCRS × Mérida — programación con bloques')).toBeVisible()
    await page.screenshot({
      path: evidence('04-localstorage-unavailable-still-detects-spanish'),
      fullPage: true,
    })
  })
})

test.describe('browser detected as Portuguese (pt-BR)', () => {
  test.use({ locale: 'pt-BR' })

  test('switching the language applies immediately and persists across a reload', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('language-option-pt')).toHaveAttribute('aria-current', 'true')

    // 02 — clicking EN switches the whole UI right away, no reload involved.
    await page.getByTestId('language-option-en').click()
    await expect(page.getByTestId('language-option-en')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByText('PUCRS × Mérida — block programming showdown')).toBeVisible()
    await page.screenshot({ path: evidence('02-switched-to-english-immediately'), fullPage: true })

    // 03 — reloading on the same device keeps the chosen language.
    await page.reload()
    await expect(page.getByTestId('language-option-en')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByText('PUCRS × Mérida — block programming showdown')).toBeVisible()
    await page.screenshot({ path: evidence('03-still-english-after-reload'), fullPage: true })
  })
})
