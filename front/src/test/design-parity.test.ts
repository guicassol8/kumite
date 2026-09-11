import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// `docs/design/tokens/tokens.css` is the identity's source of truth; the front
// consumes a hand-made copy in `src/index.css` because Tailwind v4 needs the
// tokens in the file it compiles. Two copies of the same palette drift in
// silence — a value tweaked in docs/ and never mirrored here would leave every
// screen a shade off the spec with nothing failing. This test is the guard.
//
// It compares **by token name, not by block**: the radius scale lives in
// `:root` over in docs/ and has to live inside `@theme inline` here (Tailwind
// only emits `rounded-*` utilities from theme variables), so pinning the block
// would fail on a difference that is deliberate.
//
// The direction is one-way — every token docs/ declares must exist here with
// the same value; extras here are fine, since `index.css` also carries the
// shadcn `--color-*` mappings, which are plumbing, not identity.
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const TOKENS_CSS = path.join(REPO_ROOT, 'docs/design/tokens/tokens.css')
const INDEX_CSS = path.join(REPO_ROOT, 'front/src/index.css')

// Same story for the icons: Vite only serves what sits in `front/public/`,
// so the two files are copies of `docs/design/logo/`. Byte for byte, because
// a re-export of the logo that never reached `public/` is a stale favicon
// nobody notices until the tab is wrong in front of an auditorium.
const COPIED_ICONS = [
  ['docs/design/logo/favicon.svg', 'front/public/favicon.svg'],
  ['docs/design/logo/png/apple-touch-icon-180.png', 'front/public/apple-touch-icon.png'],
] as const

/** Blockly's palette (#218) is consumed by `@kumite/blocks`, not by the theme. */
const isBlockToken = (name: string) => name.startsWith('--block-')

type Scope = 'light' | 'dark'

/**
 * `--name: value` pairs per scope. `:root` and `@theme inline` are one bucket
 * (see the note above); `.dark` is the other. Both files are flat — selector,
 * declarations, close — so a block scan is enough; no nesting to handle.
 */
function readTokens(file: string): Record<Scope, Map<string, string>> {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const scopes: Record<Scope, Map<string, string>> = { light: new Map(), dark: new Map() }

  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Everything since the previous brace, which may trail a statement at-rule
    // — `@custom-variant dark (&:is(.dark *));` sits right above `:root` and
    // would otherwise make the light block look dark.
    const selector = (block[1] ?? '').split(';').at(-1) ?? ''
    const which = selector.includes('.dark') ? 'dark' : 'light'
    for (const declaration of (block[2] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const name = declaration[1] ?? ''
      const value = declaration[2] ?? ''
      if (isBlockToken(name)) continue
      // Lowercased because hex is case-insensitive in CSS and biome normalizes
      // it — a difference in case is not drift.
      scopes[which].set(name, value.trim().replace(/\s+/g, ' ').toLowerCase())
    }
  }

  return scopes
}

describe('the identity tokens copied into front/src/index.css', () => {
  const source = readTokens(TOKENS_CSS)
  const front = readTokens(INDEX_CSS)

  for (const scope of ['light', 'dark'] as const) {
    it(`carries every ${scope} token of docs/design/tokens/tokens.css, with the same value`, () => {
      const drifted = [...source[scope]].flatMap(([name, expected]) => {
        const actual = front[scope].get(name)
        return actual === expected
          ? []
          : [`${name}: ${actual ?? '(missing)'} — expected ${expected}`]
      })

      expect(drifted).toEqual([])
    })
  }
})

describe('the icons copied into front/public', () => {
  for (const [source, copy] of COPIED_ICONS) {
    it(`keeps ${copy} byte for byte equal to ${source}`, () => {
      const original = readFileSync(path.join(REPO_ROOT, source))
      const served = readFileSync(path.join(REPO_ROOT, copy))

      expect(served.equals(original)).toBe(true)
    })
  }
})
