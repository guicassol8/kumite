import { expect, type Page, test } from '@playwright/test'

import { findContrastViolations } from './support/contrast'

// #234 — the guard for the guard. `dark-contrast.spec.ts` asserts that the
// meter finds nothing on the real routes; that only means something if the
// meter does find a known-bad pair. Every case here is a static page built
// with `setContent`, so it needs neither the back nor the database.
//
// Reference ratios (WCAG 2.x, computed from the sRGB values): #777 on #fff is
// 4.48:1 — just under AA for normal text, above the 3:1 large-text bar — and
// #595959 on #fff is 7.0:1.

async function mount(page: Page, body: string) {
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#fff;font-family:sans-serif">${body}</body></html>`,
  )
}

test.describe('the contrast meter (#234)', () => {
  test('flags #777 on white at 16px, as normal text below 4.5:1', async ({ page }) => {
    await mount(page, '<p data-testid="grey" style="color:#777;font-size:16px">cinza</p>')

    const violations = await findContrastViolations(page)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ text: 'cinza', testid: 'grey', required: 4.5 })
    expect(violations[0]?.ratio).toBeCloseTo(4.48, 1)
  })

  test('lets the same #777 pass at 24px, where large text needs 3:1', async ({ page }) => {
    await mount(page, '<p style="color:#777;font-size:24px">grande</p>')

    expect(await findContrastViolations(page)).toEqual([])
  })

  test('counts 18.66px bold as large text too', async ({ page }) => {
    await mount(page, '<p style="color:#777;font-size:19px;font-weight:700">negrito</p>')

    expect(await findContrastViolations(page)).toEqual([])
  })

  test('passes #595959 on white', async ({ page }) => {
    await mount(page, '<p style="color:#595959;font-size:16px">legível</p>')

    expect(await findContrastViolations(page)).toEqual([])
  })

  test('composes the background through the ancestors, not the element alone', async ({ page }) => {
    // Paper text on a transparent span inside a dark card: fine. The same text
    // measured against the white body would be ~1:1.
    await mount(
      page,
      '<div style="background:#120f0d;padding:8px"><span style="color:#fcfaf7">no escuro</span></div>',
    )

    expect(await findContrastViolations(page)).toEqual([])
  })

  test('multiplies the effective opacity into the text colour', async ({ page }) => {
    // #595959 alone passes at 7:1; at 40% opacity it lands near 2:1.
    await mount(
      page,
      '<div style="opacity:.4"><p data-testid="faded" style="color:#595959">apagado</p></div>',
    )

    const violations = await findContrastViolations(page)

    expect(violations.map((v) => v.testid)).toEqual(['faded'])
  })

  test('reads a translucent text colour the way it is seen', async ({ page }) => {
    await mount(page, '<p style="color:rgb(0 0 0 / 0.3)">translúcido</p>')

    expect(await findContrastViolations(page)).toHaveLength(1)
  })

  test('skips disabled controls, aria-hidden and sr-only text', async ({ page }) => {
    await mount(
      page,
      `<button disabled style="color:#ccc">desabilitado</button>
       <button aria-disabled="true" style="color:#ccc">aria desabilitado</button>
       <span aria-hidden="true" style="color:#eee">decorativo</span>
       <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);color:#eee">leitor de tela</span>`,
    )

    expect(await findContrastViolations(page)).toEqual([])
  })

  test('skips whatever the exclude selectors cover', async ({ page }) => {
    await mount(page, '<div class="canvas"><p style="color:#eee">bloco</p></div>')

    expect(await findContrastViolations(page, { exclude: ['.canvas'] })).toEqual([])
    expect(await findContrastViolations(page)).toHaveLength(1)
  })

  test('measures an icon-only button against 3:1', async ({ page }) => {
    const icon = (color: string) =>
      `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 8h12"/></svg>`.replace(
        'currentColor',
        color,
      )
    await mount(
      page,
      `<button data-testid="faint-icon" aria-label="x" style="color:#ccc;background:#fff;border:0">${icon('currentColor')}</button>
       <button data-testid="ok-icon" aria-label="y" style="color:#767676;background:#fff;border:0">${icon('currentColor')}</button>`,
    )

    const violations = await findContrastViolations(page)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ testid: 'faint-icon', required: 3 })
  })

  test('measures what a text field shows: its value, or its placeholder when empty', async ({
    page,
  }) => {
    // Neither is a text node, so the text sweep alone never sees a field —
    // a faint placeholder would pass blind.
    await mount(
      page,
      `<input data-testid="faint-placeholder" placeholder="seu time" style="color:#000" />
       <input data-testid="ok-value" value="Time Azul" style="color:#595959" />
       <input data-testid="faint-value" value="Time Rosa" style="color:#ccc" />
       <textarea data-testid="ok-textarea" placeholder="descreva" style="color:#000"></textarea>
       <style>[data-testid="faint-placeholder"]::placeholder{color:#ccc;opacity:1}
              [data-testid="ok-textarea"]::placeholder{color:#595959;opacity:1}</style>`,
    )

    const violations = await findContrastViolations(page)

    expect(violations.map((v) => v.testid).sort()).toEqual(['faint-placeholder', 'faint-value'])
    expect(violations.find((v) => v.testid === 'faint-placeholder')?.text).toBe('seu time')
  })

  test('leaves non-text inputs and disabled fields alone', async ({ page }) => {
    await mount(
      page,
      `<input type="checkbox" style="color:#eee" />
       <input type="hidden" value="segredo" />
       <input disabled placeholder="desligado" style="color:#eee" />`,
    )

    expect(await findContrastViolations(page)).toEqual([])
  })

  test('fails loudly when an ancestor paints a background image', async ({ page }) => {
    await mount(
      page,
      '<div data-testid="gradient" style="background-image:linear-gradient(#000,#fff)"><p style="color:#000">sobre gradiente</p></div>',
    )

    const violations = await findContrastViolations(page)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ text: 'sobre gradiente', unmeasurable: true })
  })
})
