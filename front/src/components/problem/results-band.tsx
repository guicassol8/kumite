import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelImperativeHandle, PanelProps } from 'react-resizable-panels'

import { ResizablePanel } from '@/components/ui/resizable'

export type ResultsPanelProps = {
  panelRef: Ref<PanelImperativeHandle>
  onResize: PanelProps['onResize']
  /** `"0%"` before there is anything to show — see `problem-panels.tsx`. */
  defaultSize: PanelProps['defaultSize']
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
 */
export function ResultsPanel({
  panelRef,
  onResize,
  defaultSize,
  disabled,
  children,
}: ResultsPanelProps) {
  return (
    <ResizablePanel
      id="results"
      collapsible
      collapsedSize={0}
      defaultSize={defaultSize}
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
