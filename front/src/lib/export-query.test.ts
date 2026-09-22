import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  api: {
    organizer: {
      export: { $get: vi.fn() },
      'export.csv': { $get: vi.fn() },
    },
  },
}))

import { api } from './api'
import { fetchEventExport, fetchExportCsv } from './export-query'

// Written via fromCharCode, never as a literal U+FEFF in the source: biome
// rewrites the escape '\uFEFF' into the raw character, which is invisible in
// a diff and in review (same reason as blocks/src/fixtures).
const BOM = String.fromCharCode(0xfeff)

const mockedJsonGet = vi.mocked(api.organizer.export.$get)
const mockedCsvGet = vi.mocked(api.organizer['export.csv'].$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function response(ok: boolean, body: { json?: unknown; blob?: Blob }): any {
  return {
    ok,
    json: async () => body.json,
    blob: async () => body.blob,
    // Present and deliberately lossy: Response.text() runs the Encoding
    // Standard's UTF-8 decode, which strips a leading BOM. A fetch that reads
    // the CSV with .text() therefore silently loses it — this stub reproduces
    // that, so the assertion below fails if the read ever goes back to text.
    text: async () => (await body.blob?.text())?.replace(new RegExp(`^${BOM}`), ''),
  }
}

describe('fetchEventExport', () => {
  it('returns the parsed bundle', async () => {
    const bundle = { generatedAt: '2026-09-20T12:00:00.000Z', rounds: [] }
    mockedJsonGet.mockResolvedValue(response(true, { json: bundle }))

    await expect(fetchEventExport()).resolves.toEqual(bundle)
  })

  it('throws when the API refuses', async () => {
    mockedJsonGet.mockResolvedValue(response(false, { json: { error: 'forbidden' } }))

    await expect(fetchEventExport()).rejects.toThrow()
  })
})

describe('fetchExportCsv', () => {
  it('keeps the BOM the back sent, which .text() would have eaten', async () => {
    const served = new Blob([`${BOM}posicao;time\r\n`], { type: 'text/csv' })
    mockedCsvGet.mockResolvedValue(response(true, { blob: served }))

    // The bytes that reach the file must be the bytes the API served. Read
    // through .text() both assertions fail: the result is a string, not this
    // Blob, and it is 3 bytes shorter because UTF-8 decode drops the leading
    // BOM — which is what makes Excel show "MÃ©rida" for "Mérida".
    const body = await fetchExportCsv('ranking')
    expect(body).toBe(served)
    // 3 (BOM) + 12 ("posicao;time") + 2 (CRLF).
    expect(body.size).toBe(17)
    expect(mockedCsvGet).toHaveBeenCalledWith({ query: { kind: 'ranking' } })
  })

  it('throws when the API refuses', async () => {
    mockedCsvGet.mockResolvedValue(response(false, { blob: new Blob([]) }))

    await expect(fetchExportCsv('teams')).rejects.toThrow()
  })
})
