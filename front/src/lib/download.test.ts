import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadFile, exportFilename } from './download'

// Written via fromCharCode, never as a literal U+FEFF in the source: biome
// rewrites the escape '\uFEFF' into the raw character, which is invisible in
// a diff and in review (same reason as blocks/src/fixtures).
const BOM = String.fromCharCode(0xfeff)

// jsdom implements neither of these, so they are stubbed rather than spied.
// Typed with its argument so the Blob handed over can be asserted on.
const createObjectURL = vi.fn((_blob: Blob) => 'blob:kumite/1')
const revokeObjectURL = vi.fn((_url: string) => undefined)

/** Every anchor this module creates, with `click` replaced — jsdom has no
 * downloads, and a real click on an `href` it cannot navigate to only prints
 * "Not implemented: navigation". `onClick` is what each test wants to observe. */
function captureAnchors(onClick: (anchor: HTMLAnchorElement) => void): void {
  const realCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = realCreateElement(tag)
    if (tag === 'a') {
      vi.spyOn(element as HTMLAnchorElement, 'click').mockImplementation(() => {
        onClick(element as HTMLAnchorElement)
      })
    }
    return element
  })
}

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downloadFile', () => {
  it('clicks an anchor carrying the filename and then cleans up after itself', () => {
    const clicked: HTMLAnchorElement[] = []
    captureAnchors((anchor) => clicked.push(anchor))

    downloadFile('kumite-ranking-2026-09-20.csv', 'a;b\r\n', 'text/csv;charset=utf-8')

    expect(clicked).toHaveLength(1)
    expect(clicked[0]?.download).toBe('kumite-ranking-2026-09-20.csv')
    expect(clicked[0]?.getAttribute('href')).toBe('blob:kumite/1')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:kumite/1')
    // The anchor is a means, not a side effect: nothing of it survives.
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })

  it('revokes the blob URL even when the click throws', () => {
    captureAnchors(() => {
      throw new Error('click blew up')
    })

    expect(() => downloadFile('x.csv', 'a', 'text/csv')).toThrow('click blew up')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:kumite/1')
  })

  it('passes the content and the mime type through to the Blob', () => {
    captureAnchors(() => {})

    downloadFile('x.csv', `${BOM}a;b\r\n`, 'text/csv;charset=utf-8')

    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob?.type).toBe('text/csv;charset=utf-8')
    expect(blob?.size).toBeGreaterThan(0)
  })
})

describe('exportFilename', () => {
  it('names the file kumite-<kind>-<date>.<ext> with a UTC date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T23:30:00Z'))

    expect(exportFilename('ranking', 'csv')).toBe('kumite-ranking-2026-09-20.csv')
    expect(exportFilename('export', 'json')).toBe('kumite-export-2026-09-20.json')

    vi.useRealTimers()
  })
})
