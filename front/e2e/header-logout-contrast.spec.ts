import { expect, type Locator, type Page, test } from '@playwright/test'

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

/**
 * The label's colour and the colour a viewer actually sees behind it — the
 * Acceptance's "fundo efetivo do botão".
 *
 * Reading `backgroundColor` off the button alone is not enough: the fix makes
 * it `bg-transparent`, so what shows through is the chrome, and the hover veil
 * is a `chrome-foreground/10` film over it. The ancestor chain is therefore
 * painted onto a 1×1 canvas, outermost first, exactly as the compositor
 * stacks it.
 *
 * The canvas is also the parser, deliberately. `getComputedStyle` does not
 * always answer in `rgb()`: Tailwind's alpha modifier (`/10`) and any colour
 * sampled during a transition come back as `oklab(0.959 0.001 0.003 / 0.1)`,
 * and reading that with a `[\d.]+` regex yields `rgb(0.959, 0.001, 0.003)` —
 * an almost-black that is nowhere near the paper it describes. Handing the
 * string to `fillStyle` uses the browser's own colour parser instead, and
 * because the stack is opaque by the time it is read, `getImageData` gives
 * back exact sRGB bytes.
 */
function measure(locator: Locator): Promise<{ text: Rgb; background: Rgb }> {
  return locator.evaluate((el) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d context to measure colours with')

    // An unparseable value leaves `fillStyle` at whatever it was, so it is
    // reset to fully transparent first: a value the browser rejects then
    // paints nothing instead of silently repainting the previous layer.
    const paint = (value: string) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
    }

    const read = (): Rgb => {
      const pixel = ctx.getImageData(0, 0, 1, 1).data
      return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0]
    }

    const layers: string[] = []
    for (let node: Element | null = el; node; node = node.parentElement) {
      layers.push(getComputedStyle(node).backgroundColor)
    }
    layers.reverse()

    // Under everything there is the browser canvas, which is painted white.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1, 1)
    for (const layer of layers) paint(layer)
    const background = read()

    // The label on top of that stack: opaque text lands on its own colour,
    // and a translucent one composites the way it is actually seen.
    paint(getComputedStyle(el).color)
    const text = read()

    return { text, background }
  })
}

/**
 * Lets every running CSS transition finish before a colour is read.
 *
 * The button carries `transition-all` and the theme toggle repaints the page,
 * so a `getComputedStyle` fired straight after a hover or a theme switch
 * samples a colour mid-fade — a value that belongs to no state a user ever
 * sees settle. That artifact is not hypothetical: it is what made this spec's
 * first red/green run report a broken dark theme, when what it had sampled
 * was the light palette still fading out. Keyframe animations are left alone
 * — a looping one never finishes.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const transitions = document
      .getAnimations()
      .filter((animation) => animation instanceof CSSTransition)
    await Promise.all(transitions.map((animation) => animation.finished.catch(() => undefined)))
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

/** The settled ratio between a button's label and what is really behind it. */
async function labelContrast(page: Page, locator: Locator): Promise<number> {
  await settle(page)
  const { text, background } = await measure(locator)
  return contrastRatio(text, background)
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
