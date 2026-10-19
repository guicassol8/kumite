import { expect, type Locator, type Page } from '@playwright/test'

// What a screenshot actually shows, measured against what the CSS says it
// should show (#258). A screenshot used as proof of a theme is only proof if
// its pixels are asserted: computed styles say what the CSS asks for, not
// what reached the screen (#258 reported headless Chromium keeping the old
// theme while every computed style read the new one), and a screenshot that
// looks wrong fails nothing on its own.
//
// The PNG is decoded in the browser (`createImageBitmap` + `OffscreenCanvas`)
// because there is no PNG decoder among the dependencies. It runs after the
// capture, on the captured bytes, so it cannot repaint the image it measures.
// `screenshot-pixels.spec.ts` is the guard for this guard.

export type Rgb = { r: number; g: number; b: number }

/** Per-channel tolerance: anti-aliasing and colour rounding, nothing more. */
const TOLERANCE = 3

/**
 * The pixel at viewport coordinates (`x`, `y`) of `png`, a buffer from
 * `page.screenshot()` (viewport, device scale factor 1).
 */
export function pixelAt(page: Page, png: Buffer, x: number, y: number): Promise<Rgb> {
  return page.evaluate(
    async ({ base64, x, y }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none',
      })
      if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) {
        throw new Error(`pixel (${x}, ${y}) is outside the ${bitmap.width}×${bitmap.height} image`)
      }
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('no 2d context to decode the screenshot with')
      ctx.drawImage(bitmap, 0, 0)
      const [r = 0, g = 0, b = 0] = ctx.getImageData(x, y, 1, 1).data
      return { r, g, b }
    },
    { base64: png.toString('base64'), x: Math.round(x), y: Math.round(y) },
  )
}

/**
 * The element's own computed `background-color` as sRGB bytes, parsed by the
 * browser's colour parser (a 1×1 canvas, like `contrast.ts`'s `measure`) so
 * `oklab(...)` and friends read right. Throws when it is not fully opaque:
 * what shows through a transparent element is painted by something else, so
 * comparing against its own colour would prove nothing.
 */
export function opaqueBackground(locator: Locator): Promise<Rgb> {
  return locator.evaluate((el) => {
    const value = getComputedStyle(el).backgroundColor
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d context to parse the colour with')
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data
    if (a !== 255) {
      const id = el.closest('[data-testid]')?.getAttribute('data-testid') ?? el.tagName
      throw new Error(
        `expectPaintedAsComputed: the background of "${id}" is not opaque (${value}) — ` +
          'sample an element that paints its own background, or name it in `paintedBy`',
      )
    }
    return { r, g, b }
  })
}

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Asserts that `png` shows `locator`'s computed background at `inset` px
 * inside one of its corners (top-left by default), within ±3 per channel —
 * the divergence #258 is about: computed dark, painted light. Returns the
 * colour that was expected, so a caller can also check it is the right one.
 *
 * A transparent element (a bar laid straight on the page) names the ancestor
 * whose background shows through it in `paintedBy` — `body`, say: the point
 * is still taken inside `locator`, the colour from `paintedBy`, and it is
 * `paintedBy` that must be opaque.
 */
export async function expectPaintedAsComputed(
  page: Page,
  locator: Locator,
  png: Buffer,
  {
    inset = 4,
    corner = 'top-left',
    paintedBy = locator,
  }: { inset?: number; corner?: Corner; paintedBy?: Locator } = {},
): Promise<Rgb> {
  const expected = await opaqueBackground(paintedBy)
  const box = await locator.boundingBox()
  if (!box) throw new Error('expectPaintedAsComputed: the element is not laid out')
  const x = corner.endsWith('left') ? box.x + inset : box.x + box.width - 1 - inset
  const y = corner.startsWith('top') ? box.y + inset : box.y + box.height - 1 - inset
  const actual = await pixelAt(page, png, x, y)
  const off = Math.max(
    Math.abs(actual.r - expected.r),
    Math.abs(actual.g - expected.g),
    Math.abs(actual.b - expected.b),
  )
  expect(
    off,
    `${locator} at (${Math.round(x)}, ${Math.round(y)}) is painted ` +
      `rgb(${actual.r}, ${actual.g}, ${actual.b}) but computes ` +
      `rgb(${expected.r}, ${expected.g}, ${expected.b})`,
  ).toBeLessThanOrEqual(TOLERANCE)
  return expected
}
