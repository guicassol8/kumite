import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Eyebrow: the identity's table-header role (§ 5) — Barlow Condensed, upper
// case, wide tracking. Same string `teams.tsx` uses, kept here so the panel
// spells it once.
const EYEBROW = 'font-display font-semibold text-[13px] uppercase tracking-[0.12em]'

export type PanelTableColumn<T> = {
  id: string
  header: ReactNode
  /** Tailwind width utility applied to the `th`; `table-fixed` needs it to compress. */
  width?: string
  /** `false` keeps the mobile label in the accessibility tree but hides it visually. */
  mobileLabelVisible?: boolean
  headerTestId?: string
  headerClassName?: string
  cellClassName?: string
  cell: (row: T) => ReactNode
}

export type PanelTableProps<T> = {
  testId: string
  columns: PanelTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowTestId?: (row: T) => string
  rowClassName?: (row: T) => string | undefined
  caption?: ReactNode
}

/**
 * The organizer panel's table.
 *
 * Deliberately NOT `ui/table.tsx`: that primitive wraps every table in
 * `<div class="relative w-full overflow-x-auto">`, which is exactly the answer
 * to overflow that identity § 5 forbids — "sem scroll horizontal na página",
 * and `position: sticky` is reading support inside a wide table, never the
 * answer to overflow. The same detour was already taken by hand in
 * `routes/leaderboard.tsx` (#220) and `routes/teams.tsx` (#222); this is that
 * shape factored out for the panel.
 *
 * One DOM tree serves both sizes — no duplicated elements, no duplicated
 * testids. Below `size.breakpoint-cards` (768px) the row is a card
 * (`display: flex`) and each cell carries its own label; from 768px up the
 * same nodes go back to `table-row` / `table-cell` and the columns compress
 * via `table-fixed`. Overriding `display` drops the implicit ARIA roles, so
 * every role is spelled out (same note already recorded in `leaderboard.tsx`).
 */
export function PanelTable<T>({
  testId,
  columns,
  rows,
  rowKey,
  rowTestId,
  rowClassName,
  caption,
}: PanelTableProps<T>) {
  return (
    <table
      data-testid={testId}
      role="table"
      className="w-full table-fixed text-sm md:rounded-lg md:border md:bg-card"
    >
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead className="hidden md:table-header-group">
        <tr role="row" className="border-border border-b">
          {columns.map((column) => (
            <th
              key={column.id}
              role="columnheader"
              data-testid={column.headerTestId}
              className={cn(
                EYEBROW,
                'px-3 py-3 text-left align-middle text-muted-foreground',
                column.width,
                column.headerClassName,
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="flex flex-col gap-4 md:table-row-group">
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            role="row"
            data-testid={rowTestId?.(row)}
            className={cn(
              // Hairline of 1px in --border between rows, no shadow (§ 5).
              'flex flex-col rounded-lg border border-border bg-card p-4 md:table-row md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:p-0',
              rowClassName?.(row),
            )}
          >
            {columns.map((column) => (
              <td
                key={column.id}
                role="cell"
                className={cn(
                  'flex items-start justify-between gap-3 whitespace-normal py-1 md:table-cell md:px-3 md:py-4 md:align-middle',
                  column.cellClassName,
                )}
              >
                <span
                  className={cn(
                    EYEBROW,
                    'shrink-0 md:hidden',
                    column.mobileLabelVisible === false ? 'sr-only' : 'text-muted-foreground',
                  )}
                >
                  {column.header}
                </span>
                <span className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-right wrap-anywhere md:justify-start md:text-left">
                  {column.cell(row)}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export { EYEBROW as PANEL_EYEBROW }
