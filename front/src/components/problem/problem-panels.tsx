import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type PanelImperativeHandle, useDefaultLayout } from 'react-resizable-panels'

import { ResultsPanel, ResultsToggle } from '@/components/problem/results-band'
import { StatementCard } from '@/components/problem/statement-card'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useMediaQuery } from '@/hooks/use-media-query'
import { layoutStorage } from '@/lib/layout-storage'
import type { fetchProblem } from '@/lib/problems-query'
import { cn } from '@/lib/utils'

type Problem = Awaited<ReturnType<typeof fetchProblem>>

export type ProblemPanelsProps = {
  problem: Problem
  /** The problem's letter in the round it was opened from (#219, T4). */
  positionLabel?: string
  hasResults: boolean
  closedNotice?: ReactNode
  submitBanner?: ReactNode
  /** The `<BlocklyWorkspace>` element, built once by the caller (#203, T5). */
  editor: ReactNode
  results?: ReactNode
  actionsBar: ReactNode
  /**
   * Changes identity every time a fresh run or submission lands — the
   * desktop layout reopens a collapsed results band on each one (#203, T8).
   * Not meaningful on its own, only as an effect dependency.
   */
  resultsVersion?: number
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
  positionLabel,
  hasResults,
  closedNotice,
  submitBanner,
  editor,
  results,
  actionsBar,
  resultsVersion,
}: ProblemPanelsProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  if (!isDesktop) {
    return (
      <>
        <StatementCard problem={problem} positionLabel={positionLabel} hasResults={hasResults} />
        <div
          data-testid="problem-workspace-panel"
          className="flex min-h-0 min-w-0 grow basis-0 flex-col gap-4"
        >
          {closedNotice}
          {submitBanner}
          <div
            className={cn(
              'min-w-0 grow basis-0 overflow-hidden rounded-md border',
              // The floor that keeps the editor usable. Once results are on
              // screen the participant is reading, not dragging, so on a
              // short phone the canvas lends the band part of it.
              hasResults ? 'min-h-44 short:min-h-32' : 'min-h-44',
            )}
          >
            {editor}
          </div>
          {hasResults && (
            // The one scrollable strip of the panel: results grow into it
            // and it gives way (up to 45% of the panel) instead of pushing
            // the bar off screen (#155).
            <div
              data-testid="problem-results-band"
              className="flex max-h-[45%] min-h-0 shrink flex-col gap-4 overflow-auto"
            >
              {results}
            </div>
          )}
          {/* Last in the panel and never shrinking: that is what keeps
              Executar, Limpar and Enviar on screen whatever the results do. */}
          {actionsBar}
        </div>
      </>
    )
  }

  return (
    <DesktopPanels
      problem={problem}
      positionLabel={positionLabel}
      hasResults={hasResults}
      closedNotice={closedNotice}
      submitBanner={submitBanner}
      editor={editor}
      results={results}
      actionsBar={actionsBar}
      resultsVersion={resultsVersion}
    />
  )
}

function DesktopPanels({
  problem,
  positionLabel,
  hasResults,
  closedNotice,
  submitBanner,
  editor,
  results,
  actionsBar,
  resultsVersion,
}: Omit<ProblemPanelsProps, 'problem'> & { problem: Problem }) {
  const { t } = useTranslation()
  const [statementCollapsed, setStatementCollapsed] = useState(false)
  const statementPanelRef = useRef<PanelImperativeHandle>(null)
  const [resultsCollapsed, setResultsCollapsed] = useState(false)
  const resultsPanelRef = useRef<PanelImperativeHandle>(null)

  // One participant preference, not per-problem (`layoutStorage`, #203, T9).
  // `onlySaveAfterUserInteractions` is what keeps a window resize — or the
  // reopen effect above, an imperative call with no pointer/keyboard behind
  // it — from overwriting a size the participant actually chose.
  const { defaultLayout: statementDefaultLayout, onLayoutChanged: onStatementLayoutChanged } =
    useDefaultLayout({
      id: 'problem-h',
      storage: layoutStorage,
      onlySaveAfterUserInteractions: true,
    })
  const { defaultLayout: resultsDefaultLayout, onLayoutChanged: onResultsLayoutChanged } =
    useDefaultLayout({
      id: 'problem-v',
      storage: layoutStorage,
      onlySaveAfterUserInteractions: true,
    })

  // Reopens the band on every fresh run or submission, even one the
  // participant collapsed earlier — `expand()` is a no-op if already open.
  // Depends on `resultsVersion` rather than `hasResults`, which flips true
  // only once (on the very first run) and would never fire again after that.
  useEffect(() => {
    if (!hasResults) return
    resultsPanelRef.current?.expand()
    setResultsCollapsed(false)
  }, [resultsVersion, hasResults])

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
      <ResizablePanelGroup
        orientation="horizontal"
        id="problem-h"
        className="min-h-0 min-w-0 grow"
        defaultLayout={statementDefaultLayout}
        onLayoutChanged={onStatementLayoutChanged}
      >
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
            positionLabel={positionLabel}
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
        <ResizablePanel id="editor" minSize="50%" className="flex h-full min-h-0 flex-col gap-2">
          {closedNotice}
          {submitBanner}
          {/* Canvas, handle and results Panel all stay mounted whether or
              not there are results yet — react-resizable-panels does not
              expect a Group's panel *count* to change after mount (it threw
              "No layout data found for index" the one time this tried
              conditionally adding the results Panel later). Before the
              first run, `results` is `undefined` and the results Panel
              starts at 0% (disabled, so there's nothing to drag open onto
              emptiness) — visually identical to no split at all, and the
              canvas itself never remounts, which is the one thing #178
              already fixed this file to avoid. */}
          <ResizablePanelGroup
            orientation="vertical"
            id="problem-v"
            className="min-h-0 grow"
            defaultLayout={resultsDefaultLayout}
            onLayoutChanged={onResultsLayoutChanged}
          >
            <ResizablePanel id="canvas" minSize="50%" className="flex h-full min-h-0">
              {editor}
            </ResizablePanel>
            <ResizableHandle withHandle id="problem-results-handle" disabled={!hasResults} />
            <ResultsPanel
              disabled={!hasResults}
              defaultSize={hasResults ? '25%' : '0%'}
              panelRef={resultsPanelRef}
              onResize={(panelSize) => setResultsCollapsed(panelSize.asPercentage === 0)}
            >
              {results}
            </ResultsPanel>
          </ResizablePanelGroup>
          {hasResults && (
            <ResultsToggle
              collapsed={resultsCollapsed}
              onToggle={() => {
                if (resultsCollapsed) {
                  resultsPanelRef.current?.expand()
                  setResultsCollapsed(false)
                } else {
                  resultsPanelRef.current?.collapse()
                  setResultsCollapsed(true)
                }
              }}
            />
          )}
          {actionsBar}
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  )
}
