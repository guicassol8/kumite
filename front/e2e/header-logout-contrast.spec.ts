import { expect, type Locator, type Page, test } from '@playwright/test'

// #271 — the Sair button used to be a paper slab on the charcoal chrome, with
// a nearly-white label on it: 1.08:1 at rest and 1.31:1 on hover in the light
// theme, where AA asks for 4.5:1. The jsdom guard in
// `src/components/header.test.tsx` can only assert the classes that survive
// tailwind-merge — jsdom never applies Tailwind's stylesheet — so the actual
// ratio is measured here, in a real browser, in both themes and at both
// viewports. Doubles as the PR's visual evidence.
const evidence = (name: string) => `e2e/evidence/271/${name}.png`

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

// WCAG 2.x AA for text. The assertions check the threshold, not the exact
// ratio: a token nudged inside the redesign epic (#214) should not turn this
// spec red while the button is still perfectly legible.
const AA_CONTRAST = 4.5

const PASSWORD = 'supersecret'
const stamp = Date.now().toString().slice(-6)

type Rgb = [number, number, number]

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

function textColor(locator: Locator): Promise<Rgb> {
  return locator.evaluate((el) => {
    const parts = getComputedStyle(el).color.match(/[\d.]+/g) ?? ['0', '0', '0']
    return [Number(parts[0]), Number(parts[1]), Number(parts[2])] as [number, number, number]
  })
}

/**
 * The colour a viewer actually sees behind the label — the Acceptance's "fundo
 * efetivo do botão".
 *
 * Reading `backgroundColor` off the button alone is not enough here: the fix
 * makes it `bg-transparent` (`rgba(0,0,0,0)`, the chrome showing through) and
 * the hover veil is `chrome-foreground/10` (`rgba(243,241,239,0.1)`). So this
 * walks up the ancestor chain compositing each layer over the next until the
 * accumulated alpha reaches 1, exactly as the compositor does.
 */
function effectiveBackground(locator: Locator): Promise<Rgb> {
  return locator.evaluate((el) => {
    const parse = (value: string): [number, number, number, number] => {
      const parts = value.match(/[\d.]+/g)
      if (!parts || parts.length < 3) return [0, 0, 0, 0]
      return [
        Number(parts[0]),
        Number(parts[1]),
        Number(parts[2]),
        parts.length > 3 ? Number(parts[3]) : 1,
      ]
    }

    const composited: [number, number, number] = [0, 0, 0]
    let remaining = 1
    let node: Element | null = el

    while (node && remaining > 0.001) {
      const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor)
      if (a > 0) {
        const weight = remaining * a
        composited[0] += r * weight
        composited[1] += g * weight
        composited[2] += b * weight
        remaining -= weight
      }
      node = node.parentElement
    }

    // Past <html> there is only the canvas, which the browser paints white.
    if (remaining > 0.001) {
      composited[0] += 255 * remaining
      composited[1] += 255 * remaining
      composited[2] += 255 * remaining
    }

    return composited
  })
}

/** WCAG 2.x relative luminance of an sRGB colour. */
function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** The measured ratio between a button's label and what is really behind it. */
async function labelContrast(locator: Locator): Promise<number> {
  const [color, background] = await Promise.all([textColor(locator), effectiveBackground(locator)])
  return contrastRatio(color, background)
}

/** Reaches the button the way a keyboard user does, so `:focus-visible` fires. */
async function tabTo(page: Page, testId: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    if (focused === testId) return
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
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('01-claro-repouso'), clip: await headerClip(page) })

    // 2 — hover. A second defect the issue had not measured: the `outline`
    // variant's `hover:text-accent-foreground` painted the label ink-dark over
    // a `chrome-foreground/10` veil, 1.31:1.
    await button.hover()
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('02-claro-hover'), clip: await headerClip(page) })

    // 3 — keyboard focus: the label stays readable and the ring is drawn.
    await page.mouse.move(0, 0)
    await tabTo(page, 'header-logout-button')
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    expect(await button.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
    await page.screenshot({ path: evidence('03-claro-foco'), clip: await headerClip(page) })
  })

  test('mantém o rótulo legível em repouso e no hover no tema escuro', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signUpParticipant(page, `logout-contrast-dark-${stamp}@edu.pucrs.br`)

    await page.getByTestId('header-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    const button = page.getByTestId('header-logout-button')
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('04-escuro-repouso'), clip: await headerClip(page) })

    await button.hover()
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
  })
})

test.describe('o botão Sair no painel mobile — 390×844 (#271)', () => {
  test('mantém o rótulo legível dentro do painel nos dois temas', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await signUpParticipant(page, `logout-contrast-mobile-${stamp}@edu.pucrs.br`)

    await page.getByTestId('header-mobile-menu-trigger').click()
    const button = page.getByTestId('header-mobile-logout-button')
    await expect(button).toBeVisible()

    // 5 — light, inside the sheet, which is `bg-chrome` like the bar itself.
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
    await page.screenshot({ path: evidence('05-mobile-claro') })

    // The panel carries its own theme control, so dark is reachable without
    // closing it.
    await page.getByTestId('header-mobile-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await labelContrast(button)).toBeGreaterThanOrEqual(AA_CONTRAST)
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

    // 6 — signed out: the bar is back to Entrar/Cadastrar.
    await page.screenshot({ path: evidence('06-deslogado'), clip: await headerClip(page) })
  })
})
