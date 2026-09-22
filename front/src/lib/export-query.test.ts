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

const mockedJsonGet = vi.mocked(api.organizer.export.$get)
const mockedCsvGet = vi.mocked(api.organizer['export.csv'].$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function response(ok: boolean, body: { json?: unknown; text?: string }): any {
  return { ok, json: async () => body.json, text: async () => body.text }
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
  it('reads the body as text and passes the kind as a query parameter', async () => {
    mockedCsvGet.mockResolvedValue(response(true, { text: '﻿posicao;time\r\n' }))

    // Read with .text(), never .json(): the route answers text/csv, and the
    // BOM in front of the first field is the back's, not an artifact.
    await expect(fetchExportCsv('ranking')).resolves.toBe('﻿posicao;time\r\n')
    expect(mockedCsvGet).toHaveBeenCalledWith({ query: { kind: 'ranking' } })
  })

  it('throws when the API refuses', async () => {
    mockedCsvGet.mockResolvedValue(response(false, { text: '' }))

    await expect(fetchExportCsv('teams')).rejects.toThrow()
  })
})
