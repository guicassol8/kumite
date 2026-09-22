import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchEventExport = vi.fn()
const fetchExportCsv = vi.fn()
vi.mock('@/lib/export-query', () => ({
  fetchEventExport: (...args: unknown[]) => fetchEventExport(...args),
  fetchExportCsv: (...args: unknown[]) => fetchExportCsv(...args),
}))

const downloadFile = vi.fn()
vi.mock('@/lib/download', async () => {
  // Only the browser half is mocked: exportFilename is pure and its own test
  // covers it, so the assertions below are about the real filename.
  const actual = await vi.importActual<typeof import('@/lib/download')>('@/lib/download')
  return { ...actual, downloadFile: (...args: unknown[]) => downloadFile(...args) }
})

import '@/i18n'

import { ExportMenu } from './export-menu'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'))
  fetchEventExport.mockReset()
  fetchExportCsv.mockReset()
  downloadFile.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

/** Radix's trigger opens on pointerdown/keyboard, and jsdom has no
 * pointer-capture for fireEvent.pointerDown to drive — Enter is the
 * interaction it supports (same note as header.test.tsx). */
async function open() {
  const trigger = screen.getByTestId('export-menu-trigger')
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
  return within(await screen.findByRole('menu'))
}

async function openMenu() {
  render(<ExportMenu />)
  return open()
}

describe('ExportMenu', () => {
  it('offers the JSON bundle and the three CSVs', async () => {
    const menu = await openMenu()

    expect(menu.getByTestId('export-menu-json')).toBeDefined()
    expect(menu.getByTestId('export-menu-csv-ranking')).toBeDefined()
    expect(menu.getByTestId('export-menu-csv-teams')).toBeDefined()
    expect(menu.getByTestId('export-menu-csv-submissions')).toBeDefined()
  })

  it('downloads the JSON bundle as kumite-export-<date>.json', async () => {
    fetchEventExport.mockResolvedValue({ generatedAt: '2026-09-20T12:00:00.000Z', rounds: [] })
    const menu = await openMenu()

    fireEvent.click(menu.getByTestId('export-menu-json'))

    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1))
    expect(fetchEventExport).toHaveBeenCalledTimes(1)
    expect(downloadFile.mock.calls[0]?.[0]).toBe('kumite-export-2026-09-20.json')
    expect(downloadFile.mock.calls[0]?.[2]).toBe('application/json')
    expect(JSON.parse(downloadFile.mock.calls[0]?.[1] as string).rounds).toEqual([])
  })

  it.each([
    ['export-menu-csv-ranking', 'ranking'],
    ['export-menu-csv-teams', 'teams'],
    ['export-menu-csv-submissions', 'submissions'],
  ])('downloads %s as the %s CSV, untouched', async (testId, kind) => {
    // The BOM is the back's; the menu must hand the body over verbatim.
    fetchExportCsv.mockResolvedValue('﻿posicao;time\r\n')
    const menu = await openMenu()

    fireEvent.click(menu.getByTestId(testId))

    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1))
    expect(fetchExportCsv).toHaveBeenCalledWith(kind)
    expect(downloadFile.mock.calls[0]?.[0]).toBe(`kumite-${kind}-2026-09-20.csv`)
    expect(downloadFile.mock.calls[0]?.[1]).toBe('﻿posicao;time\r\n')
    expect(downloadFile.mock.calls[0]?.[2]).toBe('text/csv;charset=utf-8')
  })

  it('shows an error and downloads nothing when the API refuses', async () => {
    fetchExportCsv.mockRejectedValue(new Error('403'))
    const menu = await openMenu()

    fireEvent.click(menu.getByTestId('export-menu-csv-ranking'))

    expect(await screen.findByTestId('export-menu-error')).toBeDefined()
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('clears a previous error when the next download succeeds', async () => {
    fetchExportCsv.mockRejectedValueOnce(new Error('boom'))
    const menu = await openMenu()
    fireEvent.click(menu.getByTestId('export-menu-csv-ranking'))
    expect(await screen.findByTestId('export-menu-error')).toBeDefined()

    // Selecting an item closes the menu, so the second download starts from a
    // freshly opened one — which is also the only way a user reaches it.
    fetchExportCsv.mockResolvedValue('﻿time;congelado\r\n')
    const reopened = await open()
    fireEvent.click(reopened.getByTestId('export-menu-csv-teams'))

    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('export-menu-error')).toBeNull()
  })
})
