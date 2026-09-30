import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { Layout, PanelImperativeHandle, PanelProps } from 'react-resizable-panels'

import { ResizablePanel } from '@/components/ui/resizable'

/**
 * The height the band opens at when nothing better is known (#366): about
 * what `docs/design/screens/Main.png` draws — the "Resultados" header plus
 * the case rows, sized to the content rather than to a share of the screen.
 * The canvas's own `minSize="50%"` (#155) stays the floor, so on a short
 * screen the band gets less; on a tall one it does not grow with it the way
 * the old 25% did. Also what a double-click on the divider resets to.
 */
export const RESULTS_DEFAULT_SIZE = '10rem'

/**
 * The size a results band opens at: the one the participant last dragged it
 * to, if any, else the default (#307). A saved `0` is a band collapsed by a
 * drag — no preference, so the next result opens at the default (#366,
 * premise 2), keeping #203's "every fresh result reopens the band".
 *
 * A percentage *string*: `Panel.resize()` reads a bare number as pixels.
 */
export function resultsOpenSize(saved: Layout | undefined): string {
  const size = saved?.results
  if (size === undefined || !Number.isFinite(size) || size <= 0 || size >= 100) {
    return RESULTS_DEFAULT_SIZE
  }
  return `${size}%`
}

export type ResultsPanelProps = {
  panelRef: Ref<PanelImperativeHandle>
  onResize: PanelProps['onResize']
  /** No dragging (or reopening onto emptiness) before there are results. */
  disabled: boolean
  children?: ReactNode
}

/**
 * The results half of the vertical split — a `<ResizablePanel>` and nothing
 * else, so it can sit directly inside the `Group` alongside the canvas
 * Panel (react-resizable-panels requires Panel/Separator as direct children).
 * The always-visible toggle lives outside it, in `ResultsToggle` below: a
 * Panel collapsed to `collapsedSize={0}` clips its own content, so nothing
 * rendered inside this one — a header included — stays on screen once
 * collapsed.
 *
 * Its `defaultSize` is a constant on purpose. It is part of what the Panel
 * registers with, so a prop that changed on the first run re-registered the
 * Panel and remounted the whole Group, which then reopened at whatever the
 * library had cached in memory — 25% or the 10% `minSize`, by history
 * (#366). The band is closed by the Group's `defaultLayout` and opened by an
 * imperative `resize()` instead (`problem-panels.tsx`).
 */
export function ResultsPanel({ panelRef, onResize, disabled, children }: ResultsPanelProps) {
  return (
    <ResizablePanel
      id="results"
      collapsible
      collapsedSize={0}
      defaultSize={RESULTS_DEFAULT_SIZE}
      minSize="10%"
      disabled={disabled}
      panelRef={panelRef}
      onResize={onResize}
      className="flex h-full min-h-0 flex-col"
    >
      {/* react-resizable-panels sets the Panel's own `data-testid` from its
          `id` ("results"), which any `data-testid` passed alongside it
          cannot override — see the statement handle's comment in
          problem-panels.tsx. #155's e2e assertions predate this split and
          key off `problem-results-band`, so that testid moves to this inner
          wrapper instead of the Panel element itself. */}
      <div
        data-testid="problem-results-band"
        className="flex h-full min-h-0 flex-col gap-4 overflow-auto"
      >
        {children}
      </div>
    </ResizablePanel>
  )
}

export type ResultsToggleProps = {
  collapsed: boolean
  onToggle: () => void
}

/**
 * Sits right below the vertical Group, between the canvas/results split and
 * the actions bar — the one thing that stays reachable regardless of the
 * results Panel's own (possibly 0) size.
 */
export function ResultsToggle({ collapsed, onToggle }: ResultsToggleProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      data-testid="problem-results-toggle"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="flex shrink-0 items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {collapsed ? (
        <ChevronUp className="size-4" aria-hidden="true" />
      ) : (
        <ChevronDown className="size-4" aria-hidden="true" />
      )}
      {t(collapsed ? 'problem.panels.expandResults' : 'problem.panels.collapseResults')}
    </button>
  )
}
