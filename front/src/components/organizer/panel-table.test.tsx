import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PanelTable } from './panel-table'

type Row = { id: string; name: string; points: number }

const rows: Row[] = [
  { id: 'a', name: 'Blockly Busters', points: 300 },
  { id: 'b', name: 'Bit Benders', points: 120 },
]

function renderTable(extra: Partial<Parameters<typeof PanelTable<Row>>[0]> = {}) {
  return render(
    <PanelTable<Row>
      testId="demo-table"
      rows={rows}
      rowKey={(row) => row.id}
      rowTestId={(row) => `demo-row-${row.id}`}
      columns={[
        { id: 'name', header: 'Nome', width: 'w-[60%]', cell: (row) => row.name },
        {
          id: 'points',
          header: 'Pontos',
          mobileLabelVisible: false,
          cell: (row) => row.points,
        },
      ]}
      {...extra}
    />,
  )
}

// This suite renders the same table in every case; without an explicit
// cleanup the queries below match across leftover trees.
afterEach(cleanup)

describe('PanelTable', () => {
  it('spells out the ARIA roles that the display override would drop', () => {
    renderTable()

    // Below 768px the row is `display: flex` and the cell `display: flex`,
    // which strips the implicit table roles — so they are explicit.
    expect(screen.getByRole('table')).toBe(screen.getByTestId('demo-table'))
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    // 2 body rows + the header row.
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getAllByRole('cell')).toHaveLength(4)
  })

  it('renders headers as eyebrows in the display face', () => {
    renderTable()

    const [header] = screen.getAllByRole('columnheader')
    expect(header?.className).toContain('font-display')
    expect(header?.className).toContain('uppercase')
    expect(header?.className).toContain('tracking-[0.12em]')
  })

  it('never wraps the table in a horizontally scrolling ancestor', () => {
    const { container } = renderTable()

    // Identity § 5 forbids horizontal scroll as the answer to overflow, which
    // is exactly what `ui/table.tsx` does with its `overflow-x-auto` wrapper.
    // `table-fixed` plus per-column widths is what makes the columns compress.
    const table = screen.getByTestId('demo-table')
    expect(table.className).toContain('table-fixed')
    let node: HTMLElement | null = table
    while (node && node !== container) {
      expect(node.className).not.toContain('overflow-x')
      node = node.parentElement
    }
  })

  it('reflows to one card per row below the breakpoint and back to a table above it', () => {
    renderTable()

    const row = screen.getByTestId('demo-row-a')
    expect(row.className).toContain('flex')
    expect(row.className).toContain('md:table-row')
    // Hairline, no shadow.
    expect(row.className).toContain('border-border')
    expect(row.className).not.toContain('shadow')

    const [cell] = within(row).getAllByRole('cell')
    expect(cell?.className).toContain('md:table-cell')
  })

  it('repeats the column header as the mobile label of every cell', () => {
    renderTable()

    const row = screen.getByTestId('demo-row-a')
    const labels = within(row)
      .getAllByRole('cell')
      .map((cell) => cell.querySelector('span'))

    expect(labels[0]?.textContent).toBe('Nome')
    expect(labels[0]?.className).toContain('md:hidden')
    expect(labels[0]?.className).not.toContain('sr-only')
    // `mobileLabelVisible: false` keeps the label for screen readers only.
    expect(labels[1]?.textContent).toBe('Pontos')
    expect(labels[1]?.className).toContain('sr-only')
  })

  it('renders the header row only from the breakpoint up', () => {
    renderTable()

    const head = screen.getByTestId('demo-table').querySelector('thead')
    expect(head?.className).toContain('hidden')
    expect(head?.className).toContain('md:table-header-group')
  })
})
