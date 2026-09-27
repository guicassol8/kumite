import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// Guard for #204 — the ghost scrollbar left floating in the middle of the
// block editor after closing a toolbox category.
//
// The mechanism, measured in the browser and not inferred:
//   1. Blockly hides a scrollbar with the *presentation attribute*
//      `display="none"` (`core/scrollbar.ts`, `updateDisplay_`), never with
//      `style.display`.
//   2. A presentation attribute has zero weight in the cascade, so ANY CSS
//      rule beats it — and Tailwind v4's preflight ships
//      `img, svg, video, … { display: block }`.
//   3. The flyout's scrollbar is not a child of the flyout: Blockly inserts it
//      as a sibling straight into `.injectionDiv`, with `z-index: 30`
//      (`core/css.ts`). Hiding the flyout therefore never took it along, and
//      it stayed painted over the canvas exactly where the flyout had ended.
//
// The whole fix is the `svg[display='none']` rule in `src/index.css`, which
// gives the attribute its default semantics back and beats the preflight on
// specificity (0,1,1 > 0,0,1) inside the same `@layer base`.
//
// The proof of the behaviour is an e2e spec (`e2e/flyout-scrollbar.spec.ts`),
// which CI's `e2e` job runs on every PR (#295). This vitest guard is the cheap
// one: deleting the rule fails here, in the Stop hook and the `test` job,
// minutes before the e2e suite would.
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const INDEX_CSS = path.join(REPO_ROOT, 'front/src/index.css')
const PREFLIGHT_CSS = path.join(REPO_ROOT, 'front/node_modules/tailwindcss/preflight.css')

describe('the Blockly ghost-scrollbar rule (#204)', () => {
  it('declares `display: none` for svg[display="none"], after the Tailwind import', () => {
    const css = readFileSync(INDEX_CSS, 'utf8')

    // Tolerant about quoting and spacing — `svg[display='none']`,
    // `svg[display="none"]` and `svg[ display = 'none' ]` are the same rule.
    const rule = /svg\[\s*display\s*=\s*['"]none['"]\s*\]\s*\{[^}]*\bdisplay\s*:\s*none\b/
    expect(
      css,
      'src/index.css must keep the svg[display="none"] rule — without it Blockly can no longer hide a scrollbar and #204 comes back',
    ).toMatch(rule)

    // Order matters as much as the rule: the preflight arrives with
    // `@import 'tailwindcss'`, and a rule declared before it in the same layer
    // would lose the tie-break it is meant to win.
    const importIndex = css.search(/@import\s+['"]tailwindcss['"]/)
    expect(importIndex, "src/index.css must import 'tailwindcss'").toBeGreaterThanOrEqual(0)
    expect(css.search(rule)).toBeGreaterThan(importIndex)
  })

  it("still needs to exist — the preflight's `svg { display: block }` is there", () => {
    const preflight = readFileSync(PREFLIGHT_CSS, 'utf8')

    // The other half of the guard, and the one that retires it: the rule above
    // is a workaround for this exact declaration. The day a Tailwind upgrade
    // drops `svg` from the replaced-elements block, this fails and says so —
    // the workaround can then go, instead of outliving its reason in silence.
    const replacedElements =
      /(^|\n)(\s*[a-z]+\s*,\s*\n)*\s*svg\s*,[\s\S]{0,200}?\{[^}]*display:\s*block/
    expect(
      preflight,
      'tailwindcss/preflight.css no longer declares `display: block` for svg — re-check whether the svg[display="none"] rule in src/index.css is still needed (#204)',
    ).toMatch(replacedElements)
  })
})
