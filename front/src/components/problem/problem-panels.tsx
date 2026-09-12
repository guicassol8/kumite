import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelImperativeHandle } from 'react-resizable-panels'

import { StatementCard } from '@/components/problem/statement-card'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { fetchProblem } from '@/lib/problems-query'
import { cn } from '@/lib/utils'

type Problem = Awaited<ReturnType<typeof fetchProblem>>

export type ProblemPanelsProps = {
  problem: Problem
  hasResults: boolean
  closedNotice?: ReactNode
  submitBanner?: ReactNode
  /** The `<BlocklyWorkspace>` element, built once by the caller (#203, T5). */
  editor: ReactNode
  results?: ReactNode
  actionsBar: ReactNode
}

// Below this, the stacked (mobile) layout of #155/#178 is untouched — the
// collapsible/resizable panels only apply on md+ (#199 covers the phone).
const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * `/problem/$id`'s body: the statement, the editor, the results band and the
 * actions bar, arranged either as today's stacked column (< md) or as
 * collapsible, resizable panels (md+, #203).
 */
export function ProblemPanels({
  problem,
  hasResults,
  closedNotice,
  submitBanner,
  editor,
  results,
  actionsBar,
}: ProblemPanelsProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const workspaceColumn = (
    <div
      data-testid="problem-workspace-panel"
      // `h-full` is redundant but harmless on the stacked (mobile) layout,
      // where `grow`/`basis-0` already size this against its flex-column
      // parent. Inside the desktop "editor" Panel there is no such flex
      // context (react-resizable-panels' own inner wrapper is a plain
      // block box) — without an explicit height, this column shrinks to
      // its content instead of the space actually available, and adding
      // the results band pushes the actions bar down instead of the
      // canvas giving up the room (caught by e2e/problem-layout.spec.ts).
      className="flex h-full min-h-0 min-w-0 grow basis-0 flex-col gap-4"
    >
      {closedNotice}
      {submitBanner}
      <div
        className={cn(
          'min-w-0 grow basis-0 overflow-hidden rounded-md border',
          // The floor that keeps the editor usable. Once results are on
          // screen the participant is reading, not dragging, so on a short
          // phone the canvas lends the band part of it.
          hasResults ? 'min-h-44 short:min-h-32' : 'min-h-44',
        )}
      >
        {editor}
      </div>
      {hasResults && (
        // The one scrollable strip of the panel: results grow into it and it
        // gives way (up to 45% of the panel) instead of pushing the bar off
        // screen (#155).
        <div
          data-testid="problem-results-band"
          className="flex max-h-[45%] min-h-0 shrink flex-col gap-4 overflow-auto"
        >
          {results}
        </div>
      )}
      {/* Last in the panel and never shrinking: that is what keeps Executar,
          Limpar and Enviar on screen whatever the results do. */}
      {actionsBar}
    </div>
  )

  if (!isDesktop) {
    return (
      <>
        <StatementCard problem={problem} hasResults={hasResults} />
        {workspaceColumn}
      </>
    )
  }

  return (
    <DesktopPanels problem={problem} hasResults={hasResults} workspaceColumn={workspaceColumn} />
  )
}

function DesktopPanels({
  problem,
  hasResults,
  workspaceColumn,
}: {
  problem: Problem
  hasResults: boolean
  workspaceColumn: ReactNode
}) {
  const { t } = useTranslation()
  const [statementCollapsed, setStatementCollapsed] = useState(false)
  const statementPanelRef = useRef<PanelImperativeHandle>(null)

  return (
    <>
      {statementCollapsed && (
        // Outside the resizable group on purpose: a collapsed Panel is 0px
        // wide, which is not a place to put a clickable affordance back.
        <button
          type="button"
          data-testid="problem-statement-rail"
          aria-label={t('problem.panels.expandStatement')}
          onClick={() => {
            statementPanelRef.current?.expand()
            setStatementCollapsed(false)
          }}
          className="flex w-9 shrink-0 flex-col items-center gap-2 rounded-md border bg-card py-3 text-muted-foreground text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <PanelLeftOpen className="size-4" aria-hidden="true" />
          <span className="[writing-mode:vertical-rl]">{t('problem.panels.statementRail')}</span>
        </button>
      )}
      <ResizablePanelGroup orientation="horizontal" id="problem-h" className="min-h-0 min-w-0 grow">
        <ResizablePanel
          id="statement"
          collapsible
          collapsedSize={0}
          defaultSize="22%"
          minSize="15%"
          panelRef={statementPanelRef}
          // Keeps `statementCollapsed` in sync with a drag past the minimum
          // (real browsers only — jsdom has no ResizeObserver, so this path
          // is covered in e2e, not here). The two explicit clicks below set
          // the same state synchronously, which is what a unit test can see.
          onResize={(panelSize) => setStatementCollapsed(panelSize.asPercentage === 0)}
        >
          <StatementCard
            problem={problem}
            hasResults={hasResults}
            fitContainer
            headerAction={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="problem-statement-collapse"
                aria-label={t('problem.panels.collapseStatement')}
                onClick={() => {
                  statementPanelRef.current?.collapse()
                  setStatementCollapsed(true)
                }}
              >
                <PanelLeftClose className="size-4" aria-hidden="true" />
              </Button>
            }
          />
        </ResizablePanel>
        <ResizableHandle
          withHandle
          // react-resizable-panels sets `data-testid` from `id` itself,
          // overriding any `data-testid` passed alongside it — `id` is the
          // one prop that actually reaches the DOM as both.
          id="problem-statement-handle"
          aria-label={t('problem.panels.statementHandle')}
        />
        <ResizablePanel id="editor" minSize="50%" className="min-h-0">
          {workspaceColumn}
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  )
}
