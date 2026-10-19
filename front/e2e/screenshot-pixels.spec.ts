import { expect, type Page, test } from '@playwright/test'

import { expectPaintedAsComputed, pixelAt } from './support/screenshot-pixels'

// #258 — the guard for the guard. `problem-dark-repaint.spec.ts` and the
// 08-modo-escuro capture of `problem-panels.spec.ts` trust the pixel meter to
// tell a screenshot that shows the dark theme from one that only computes it;
// that only means something if the meter reads known colours exactly and
// catches a stale pixel. Static pages via `setContent`, no back needed.

async function mount(page: Page, body: string) {
  await page.setViewportSize({ width: 400, height: 300 })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#fff">${body}</body></html>`,
  )
}

test.describe('the screenshot pixel meter (#258)', () => {
  test('reads known colours exactly, where they are', async ({ page }) => {
    await mount(
      page,
      `<div style="position:absolute;left:0;top:0;width:100px;height:100px;background:#120f0d"></div>
       <div style="position:absolute;left:100px;top:0;width:100px;height:100px;background:rgb(242,240,236)"></div>
       <div style="position:absolute;left:0;top:100px;width:100px;height:100px;background:#dd2824"></div>`,
    )
    const png = await page.screenshot()

    expect(await pixelAt(page, png, 50, 50)).toEqual({ r: 18, g: 15, b: 13 })
    expect(await pixelAt(page, png, 150, 50)).toEqual({ r: 242, g: 240, b: 236 })
    expect(await pixelAt(page, png, 50, 150)).toEqual({ r: 221, g: 40, b: 36 })
    expect(await pixelAt(page, png, 250, 250)).toEqual({ r: 255, g: 255, b: 255 })
  })

  test('passes an element painted as it computes, and returns that colour', async ({ page }) => {
    await mount(
      page,
      '<div data-testid="card" style="margin:20px;width:120px;height:80px;background:oklch(0.2 0.01 40)"></div>',
    )
    const png = await page.screenshot()

    const painted = await expectPaintedAsComputed(page, page.getByTestId('card'), png, {
      corner: 'bottom-right',
    })
    expect(painted.r).toBeLessThan(60)
  })

  test('fails on a stale pixel: computed dark, painted light', async ({ page }) => {
    // What #258 looks like from the outside: the element computes one colour
    // while something else is what reaches the screen. Here the "something
    // else" is a light overlay the pointer passes through.
    await mount(
      page,
      `<div data-testid="card" style="margin:20px;width:120px;height:80px;background:#120f0d"></div>
       <div style="position:absolute;inset:0;background:rgb(242,240,236);pointer-events:none"></div>`,
    )
    const png = await page.screenshot()

    await expect(expectPaintedAsComputed(page, page.getByTestId('card'), png)).rejects.toThrow(
      /painted rgb\(242, 240, 236\) but computes rgb\(18, 15, 13\)/,
    )
  })

  test('reads a transparent element against the ancestor named as painting it', async ({
    page,
  }) => {
    await mount(
      page,
      `<div data-testid="page" style="padding:20px;background:#120f0d">
         <div data-testid="bar" style="height:40px"></div>
       </div>
       <div data-testid="light" style="height:40px;background:rgb(242,240,236)"></div>`,
    )
    const png = await page.screenshot()

    const painted = await expectPaintedAsComputed(page, page.getByTestId('bar'), png, {
      paintedBy: page.getByTestId('page'),
    })
    expect(painted).toEqual({ r: 18, g: 15, b: 13 })
    // The point is still the bar's: naming the wrong ancestor fails.
    await expect(
      expectPaintedAsComputed(page, page.getByTestId('bar'), png, {
        paintedBy: page.getByTestId('light'),
      }),
    ).rejects.toThrow(/painted rgb\(18, 15, 13\) but computes rgb\(242, 240, 236\)/)
  })

  test('refuses an element that does not paint its own background', async ({ page }) => {
    await mount(page, '<div data-testid="see-through" style="width:120px;height:80px"></div>')
    const png = await page.screenshot()

    await expect(
      expectPaintedAsComputed(page, page.getByTestId('see-through'), png),
    ).rejects.toThrow(/is not opaque/)
  })
})
