import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// Blockly 13 defaults `pathToMedia` to https://static.blockly.com/media/, so
// every injected workspace would pull its sprites, cursors and sounds from a
// third-party CDN — in the browser, and (as a real fetch) under vitest, where
// it surfaced as an intermittent unhandled connect timeout that failed the run
// with every test still passing. We serve the copy that ships inside the
// package instead; `blockly-workspace.tsx` points `media` at it.
//
// The cost of vendoring is drift: a `blockly` upgrade brings new media that
// public/ would not have. This test is what makes that loud instead of a
// silently broken icon.
const PACKAGE_MEDIA = path.resolve(import.meta.dirname, '../../../node_modules/blockly/media')
const VENDORED_MEDIA = path.resolve(import.meta.dirname, '../../../public/blockly-media')

const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')

describe('the vendored Blockly media', () => {
  it('holds every file the installed blockly ships, byte for byte', () => {
    const shipped = readdirSync(PACKAGE_MEDIA).sort()
    const vendored = readdirSync(VENDORED_MEDIA).sort()

    expect(vendored).toEqual(shipped)

    const drifted = shipped.filter(
      (name) => digest(path.join(PACKAGE_MEDIA, name)) !== digest(path.join(VENDORED_MEDIA, name)),
    )
    expect(drifted).toEqual([])
  })
})
