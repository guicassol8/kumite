import { expect, type Locator, type Page, test } from '@playwright/test'

import { contrastRatio, measure, settle } from './support/contrast'

// #271 — the Sair button used to be a paper slab on the charcoal chrome, with
// a nearly-white label on it: measured 1.0814:1 at rest and 1.3062:1 on hover
// in the light theme, where AA asks for 4.5:1. The jsdom guard in
// `src/components/header.test.tsx` can only assert the classes that survive
// tailwind-merge — jsdom never applies Tailwind's stylesheet — so the actual
// ratio is measured here, in a real browser, in both themes and at both
// viewports. Doubles as the PR's visual evidence.
//
// The dark theme was never the broken one: there `--accent-foreground` and
// `--chrome-foreground` are the same paper, so the variant's hover label
// landed on the right colour by coincidence (16.9:1 at rest, 13.9:1 on hover,
// even with the defect in). The spec still asserts it, because that
// coincidence is exactly the kind of thing a token nudge in #214 would end.
const evidence = (name: string) => `e2e/evidence/271/${name}.png`

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

// WCAG 2.x AA for text. The assertions check the threshold, not the exact
// ratio: a token nudged inside the redesign epic (#214) should not turn this
// spec red while the button is still perfectly legible.
const AA_CONTRAST = 4.5

const PASSWORD = 'supersecret'
const stamp = Date.now().toString().slice(-6)

/** The header's own box, so the button fills the shot instead of a few pixels. */
async function headerClip(page: Page) {
  const box = await page.getByTestId('app-header').boundingBox()
  if (!box) throw new Error('the header has no box')
  return { x: box.x, y: box.y, width: box.width, height: box.height + 8 }
}

async function signUpParticipant(page: Page, email: string) {
  await page.goto('/signup')
  await page.getByTestId('signup-name-input').fill('E2E Participante')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill('PUCRS2026')
  await page.getByTestId('signup-submit-button').click()
  // Not header-user-email: that span lives inside the desktop-only user menu
  // (hidden md:flex), so it never becomes visible at a mobile viewport.
  await expect(page).toHaveURL(/\/$/)
}

// `measure()` (ancestor-chain compositing on a 1×1 canvas), `settle()` (let
// transitions finish before reading a colour) and the WCAG maths live in
// `support/contrast.ts` since #234, shared with the dark smoke.

/** The settled ratio between a button's label and what is really behind it. */
async function labelContrast(page: Page, locator: Locator): Promise<number> {
  await settle(page)
  const { text, background } = await measure(locator)
  return contrastRatio(text, background)
}

/**
 * Reaches a header control the way a keyboard user does, so `:focus-visible`
 * fires.
 *
 * #338 — the walk starts on the header's first focusable, not wherever the
 * browser happens to be. `signUpParticipant` ends with a *click* on the signup
 * submit button, and Chromium keeps that spot as the sequential focus
 * navigation starting point even after the route change removes the button:
 * `activeElement` reads BODY, yet the next Tab lands in `<main>`. From there
 * focus had to cross every `home-closed-round-*` link on the home — one per
 * closed round in the shared database, a number every full suite run grows —
 * and wrap around the document, so past ~35 rounds the 40 Tabs ran out.
 * Focusing the home link resets that starting point; the target is still
 * reached by real Tab presses. Leaving the header fails right away: the
 * target is in the header, so a walk that exits it will never get there.
 */
async function tabTo(page: Page, testId: string): Promise<void> {
  await page.getByTestId('header-home-link').focus()
  for (let i = 0; i < 40; i++) {
    const { focused, inHeader } = await page.evaluate(() => {
      const active = document.activeElement
      return {
        focused: active?.getAttribute('data-testid') ?? active?.tagName,
        inHeader: !!active?.closest('[data-testid="app-header"]'),
      }
    })
    if (focused === testId) return
    if (!inHeader) throw new Error(`Tab left the header before reaching ${testId} (at ${focused})`)
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab never reached ${testId}`)
}

test.describe('o botão Sair sobre o chrome — desktop (#271)', () => {
  test('mantém o rótulo legível em repouso, no hover e no foco, no tema claro', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await signUpParticipant(page, `logout-contrast-light-${stamp}@edu.pucrs.br`)

    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const button = page.getByTestId('header-logout-button')
    await expect(button).toBeVisible()

    // 1 — rest. This is the state the issue measured at 1.08:1.
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('01-claro-repouso'), clip: await headerClip(page) })

    // 2 — hover. A second defect the issue had not measured: the `outline`
    // variant's `hover:text-accent-foreground` painted the label ink-dark over
    // a `chrome-foreground/10` veil, 1.3062:1.
    await button.hover()
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('02-claro-hover'), clip: await headerClip(page) })

    // 3 — keyboard focus: the label stays readable and the ring is drawn.
    await page.mouse.move(0, 0)
    await tabTo(page, 'header-logout-button')
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    expect(await button.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
    await page.screenshot({ path: evidence('03-claro-foco'), clip: await headerClip(page) })
  })

  test('mantém o rótulo legível em repouso e no hover no tema escuro', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signUpParticipant(page, `logout-contrast-dark-${stamp}@edu.pucrs.br`)

    await page.getByTestId('header-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // 4 — rest, dark. Already legible before the fix (16.9:1): here the
    // variant's paper `bg-background` sat on a dark page, so the accident ran
    // the right way. The assertion holds the accident to the rule.
    const button = page.getByTestId('header-logout-button')
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('04-escuro-repouso'), clip: await headerClip(page) })

    // 5 — hover, dark.
    await button.hover()
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('05-escuro-hover'), clip: await headerClip(page) })
  })
})

test.describe('o botão Sair no painel mobile — 390×844 (#271)', () => {
  test('mantém o rótulo legível dentro do painel nos dois temas', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await signUpParticipant(page, `logout-contrast-mobile-${stamp}@edu.pucrs.br`)

    await page.getByTestId('header-mobile-menu-trigger').click()
    const button = page.getByTestId('header-mobile-logout-button')
    await expect(button).toBeVisible()

    // 6 — light, inside the sheet, which is `bg-chrome` like the bar itself.
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('06-mobile-claro') })

    // 7 — the panel carries its own theme control, so dark is reachable
    // without closing it.
    await page.getByTestId('header-mobile-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await labelContrast(page, button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('07-mobile-escuro') })
  })
})

test.describe('o comportamento de logout segue intacto (#271)', () => {
  test('encerra a sessão e volta para a home', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signUpParticipant(page, `logout-contrast-behavior-${stamp}@edu.pucrs.br`)

    await page.getByTestId('header-logout-button').click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('header-login-link')).toBeVisible()
    await expect(page.getByTestId('header-logout-button')).toHaveCount(0)

    // 8 — signed out: the bar is back to Entrar/Cadastrar.
    await page.screenshot({ path: evidence('08-deslogado'), clip: await headerClip(page) })
  })
})
