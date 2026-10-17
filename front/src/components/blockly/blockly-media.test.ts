import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
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

describe('the vendored Blockly media', () => {
  it('holds every file the installed blockly ships, byte for byte', async () => {
    expect(await mediaDrift(PACKAGE_MEDIA, VENDORED_MEDIA)).toEqual({
      missing: [],
      extra: [],
      changed: [],
    })
  })

  it('names every file that differs, is missing or is extra (#460)', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'kumite-media-'))
    try {
      const shipped = path.join(root, 'shipped')
      const vendored = path.join(root, 'vendored')
      await writeTree(shipped, {
        'same.svg': '<svg/>',
        'changed.mp3': 'abcd',
        'grown.png': 'png',
        'missing.cur': 'cur',
      })
      await writeTree(vendored, {
        'same.svg': '<svg/>',
        'changed.mp3': 'abce',
        'grown.png': 'png!',
        'extra.gif': 'gif',
      })

      expect(await mediaDrift(shipped, vendored)).toEqual({
        missing: ['missing.cur'],
        extra: ['extra.gif'],
        changed: ['changed.mp3', 'grown.png'],
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

// #460: every listing and every read starts at once. The old body read the
// 32 files one after another, synchronously, with a sha256 each — a few ms on
// an idle disk, but over the 5 s timeout when the pre-push ran it beside other
// suites, each read waiting on the one before. A local byte-for-byte compare
// needs no hash: Buffer.equals checks the length first, then the bytes.
async function mediaDrift(shippedDir: string, vendoredDir: string) {
  const [shipped, vendored] = await Promise.all([readdir(shippedDir), readdir(vendoredDir)])
  const inVendored = new Set(vendored)
  const inShipped = new Set(shipped)
  const both = shipped.filter((name) => inVendored.has(name))
  const verdicts = await Promise.all(
    both.map(async (name) => {
      const [a, b] = await Promise.all([
        readFile(path.join(shippedDir, name)),
        readFile(path.join(vendoredDir, name)),
      ])
      return { name, same: a.equals(b) }
    }),
  )
  return {
    missing: shipped.filter((name) => !inVendored.has(name)).sort(),
    extra: vendored.filter((name) => !inShipped.has(name)).sort(),
    changed: verdicts
      .filter((verdict) => !verdict.same)
      .map((verdict) => verdict.name)
      .sort(),
  }
}

async function writeTree(dir: string, files: Record<string, string>) {
  await mkdir(dir, { recursive: true })
  await Promise.all(
    Object.entries(files).map(([name, body]) => writeFile(path.join(dir, name), body)),
  )
}
