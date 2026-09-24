import type { Locator, Page } from '@playwright/test'

// Contrast measured in a real browser — what jsdom structurally cannot do,
// since it never applies Tailwind's stylesheet. Born in #271 as the Sair
// button's meter (`header-logout-contrast.spec.ts`), moved here in #234 so the
// dark smoke (`dark-contrast.spec.ts`) can sweep whole routes with the same
// compositing. `contrast-meter.spec.ts` proves the sweep catches known-bad
// pairs, so an empty result on a real route actually means something.

export type Rgb = [number, number, number]

/**
 * The label's colour and the colour a viewer actually sees behind it — the
 * Acceptance's "fundo efetivo do botão" (#271).
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
export function measure(locator: Locator): Promise<{ text: Rgb; background: Rgb }> {
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
 * sees settle. That artifact is not hypothetical: it is what made #271's
 * first red/green run report a broken dark theme, when what it had sampled
 * was the light palette still fading out. Keyframe animations are left alone
 * — a looping one never finishes.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const transitions = document
      .getAnimations()
      .filter((animation) => animation instanceof CSSTransition)
    await Promise.all(transitions.map((animation) => animation.finished.catch(() => undefined)))
  })
}

/** WCAG 2.x relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** WCAG 2.x AA: normal text, and large text / non-text interface parts. */
export const AA_NORMAL = 4.5
export const AA_LARGE = 3

export type ContrastViolation = {
  /** The text (trimmed, at most 60 chars), or `[icon]` for an icon-only control. */
  text: string
  /** The nearest `data-testid` up the tree, to find it in the code. */
  testid: string | null
  /** Rounded to two decimals; `NaN` when `unmeasurable`. */
  ratio: number
  required: number
  text_rgb?: Rgb
  background_rgb?: Rgb
  /** An ancestor paints a `background-image`: the meter cannot compose it. */
  unmeasurable?: true
}

type Sample = {
  text: string
  testid: string | null
  large: boolean
  icon: boolean
  fg?: Rgb
  bg?: Rgb
  unmeasurable?: true
}

/**
 * Sweeps the page for text/background pairs below AA, in the state it is in
 * right now (call `settle()` first). Scope, as #234's plan fixed it:
 *
 * - every visible text node, at 4.5:1, or 3:1 when it is large (≥ 24px, or
 *   ≥ 18.66px at weight ≥ 700);
 * - every icon-only `button`/`a` (no visible text of its own), its SVG's
 *   stroke — or fill — at 3:1, the "interface component" bar;
 * - skipped: disabled controls (exempt under WCAG 1.4.3), `aria-hidden`
 *   text, anything ≤ 1px (the `sr-only` pattern), text drawn inside an
 *   `<svg>` (it paints with `fill`, not `color`), and whatever `exclude`
 *   names — the Blockly canvas, which runs its own theme.
 *
 * The background is composed like `measure()` does, from the ancestor chain,
 * with each ancestor's `opacity` folded into the layers it paints and the
 * text's own chain folded into the text. A background painted by a sibling
 * (an absolutely positioned layer) is invisible to it — the known limit of
 * the #271 approach. An ancestor with a `background-image` makes the pair
 * unmeasurable, and that is reported as a violation rather than passed.
 */
export async function findContrastViolations(
  page: Page,
  options: { exclude?: string[] } = {},
): Promise<ContrastViolation[]> {
  const samples = await page.evaluate((exclude: string[]): Sample[] => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d context to measure colours with')

    const paint = (value: string, alpha: number) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      ctx.globalAlpha = 1
    }
    const read = (): [number, number, number] => {
      const pixel = ctx.getImageData(0, 0, 1, 1).data
      return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0]
    }

    const skipSelector = ['[aria-hidden="true"]', ...exclude].join(',')
    const disabledSelector = ':disabled, [aria-disabled="true"]'

    /** Opacity of `node` and every ancestor, multiplied. */
    const effectiveOpacity = (node: Element): number => {
      let product = 1
      for (let n: Element | null = node; n; n = n.parentElement) {
        product *= Number.parseFloat(getComputedStyle(n).opacity) || 0
      }
      return product
    }

    /** Composes the ancestors' backgrounds; null when one is an image. */
    const composeBackground = (el: Element): [number, number, number] | null => {
      const chain: Element[] = []
      for (let n: Element | null = el; n; n = n.parentElement) chain.push(n)
      chain.reverse()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1, 1)
      for (const node of chain) {
        const style = getComputedStyle(node)
        if (style.backgroundImage && style.backgroundImage !== 'none') return null
        paint(style.backgroundColor, effectiveOpacity(node))
      }
      return read()
    }

    const describe = (el: Element) =>
      el.closest('[data-testid]')?.getAttribute('data-testid') ?? null

    const visible = (el: Element) =>
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true })

    const samples: Sample[] = []

    const sample = (el: Element, text: string, color: string, large: boolean, icon: boolean) => {
      const bg = composeBackground(el)
      if (!bg) {
        samples.push({ text, testid: describe(el), large, icon, unmeasurable: true })
        return
      }
      paint(color, effectiveOpacity(el))
      samples.push({ text, testid: describe(el), large, icon, fg: read(), bg })
    }

    // 1 — text nodes.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const content = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (!content) continue
      const el = node.parentElement
      if (!el) continue
      if (el.closest('script, style, noscript, template, svg')) continue
      if (el.closest(skipSelector) || el.closest(disabledSelector)) continue
      if (!visible(el)) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const rect = range.getBoundingClientRect()
      if (rect.width <= 1 || rect.height <= 1) continue
      // `sr-only` clips a 1px box: the range still reports the text's full
      // size, the element's own box does not.
      const box = el.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue

      const style = getComputedStyle(el)
      const size = Number.parseFloat(style.fontSize)
      const weight = Number.parseInt(style.fontWeight, 10) || 400
      const large = size >= 24 || (size >= 18.66 && weight >= 700)
      sample(el, content.slice(0, 60), style.color, large, false)
    }

    // 2 — icon-only controls: the icon is the only thing that says what
    // they do, so it is held to the non-text 3:1.
    for (const control of document.querySelectorAll('button, a')) {
      // The icon itself is usually `aria-hidden` (lucide), so only the
      // control's own hiding counts here.
      if (control.closest(skipSelector) || control.closest(disabledSelector)) continue
      if (!visible(control)) continue
      const ownText = (control as HTMLElement).innerText?.replace(/\s+/g, ' ').trim() ?? ''
      if (ownText) continue
      const svg = control.querySelector('svg')
      if (!svg) continue
      const box = svg.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      const style = getComputedStyle(svg)
      const ink = style.stroke && style.stroke !== 'none' ? style.stroke : style.fill
      if (!ink || ink === 'none' || ink.startsWith('url(')) continue
      sample(svg, '[icon]', ink, true, true)
    }

    return samples
  }, options.exclude ?? [])

  const violations: ContrastViolation[] = []
  for (const s of samples) {
    const required = s.large ? AA_LARGE : AA_NORMAL
    if (s.unmeasurable || !s.fg || !s.bg) {
      violations.push({
        text: s.text,
        testid: s.testid,
        ratio: Number.NaN,
        required,
        unmeasurable: true,
      })
      continue
    }
    const ratio = contrastRatio(s.fg, s.bg)
    if (ratio < required) {
      violations.push({
        text: s.text,
        testid: s.testid,
        ratio: Math.round(ratio * 100) / 100,
        required,
        text_rgb: s.fg,
        background_rgb: s.bg,
      })
    }
  }
  return violations
}
