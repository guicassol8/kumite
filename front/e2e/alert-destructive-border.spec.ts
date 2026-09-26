import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { seedParticipant, seedParticipantToken } from './support/editor-fixture'

// #308: `alertVariants.destructive` declared no border, so every error alert
// in the app sat on the neutral hairline (`--border`) instead of the crimson
// outline identity § 5 asks for. The only guards that measured an error
// alert's border (the rejected verdict, the login error) passed because those
// call sites patched the border locally — nothing measured the primitive.
//
// This one does, on a consumer that never had a local fix: the round screen's
// not-found alert. Computed colours in a real browser, not a class string, in
// both themes — the tokens differ per theme and a class check can't see that.
// Prereqs: docker compose up -d && pnpm db:migrate (seeds a participant).
const evidence = (name: string) => `e2e/evidence/308/${name}.png`

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: a destructive alert has a crimson border, not the neutral hairline`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('kumite:theme', value), theme)
    const participant = await seedParticipant(`alert-border-${theme}`)
    await seedParticipantToken(page, participant.token)

    await page.goto(`/rounds/${randomUUID()}`)
    const alert = page.getByTestId('round-detail-not-found')
    await expect(alert).toBeVisible()
    // The theme really applied — otherwise "dark" would measure light tokens.
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      theme === 'dark',
    )

    const colors = await alert.evaluate((element) => {
      const probe = (token: string) => {
        const span = document.createElement('span')
        span.style.color = `var(${token})`
        document.body.append(span)
        const color = getComputedStyle(span).color
        span.remove()
        return color
      }
      const style = getComputedStyle(element)
      return {
        sides: [
          style.borderTopColor,
          style.borderRightColor,
          style.borderBottomColor,
          style.borderLeftColor,
        ],
        crimson: probe('--destructive'),
        hairline: probe('--border'),
      }
    })

    // Sanity: the two tokens really are different colours in this theme, so
    // the inequality below can't pass vacuously.
    expect(colors.crimson).not.toBe(colors.hairline)
    for (const side of colors.sides) {
      expect(side).toBe(colors.crimson)
      expect(side).not.toBe(colors.hairline)
    }

    await page.screenshot({ path: evidence(`${theme}-alerta-erro-primitivo`), fullPage: true })
  })
}
