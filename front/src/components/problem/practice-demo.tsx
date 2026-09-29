import type { BlockLocale } from '@kumite/blocks'
import * as Blockly from 'blockly'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import { Button } from '@/components/ui/button'
import { useBlocklyTheme } from '@/hooks/use-blockly-theme'
import { applyBlocklyLocale, workspaceOptions } from '@/lib/blockly-setup'
import { type DemoScript, demoStepState, revealedAt } from '@/lib/practice-demo'
import { cn } from '@/lib/utils'

function toBlockLocale(language: string): BlockLocale {
  return language === 'es' || language === 'en' ? language : 'pt'
}

// Navigated, never edited (#212): Blockly's read-only mode drops the toolbox,
// the trashcan, dragging and the context menu; scrolling and zoom stay.
const demoOptions: Partial<Blockly.BlocklyOptions> = {
  ...workspaceOptions,
  readOnly: true,
  trashcan: false,
}

export type PracticeDemoCanvasProps = {
  script: DemoScript
  /** 0-based index into `script.steps`. */
  step: number
  className?: string
}

/**
 * The read-only canvas of the practice demo (#212). It has no `onChange`, so
 * nothing it shows ever reaches the participant's autosave — the participant's
 * own canvas stays mounted underneath, untouched.
 */
export function PracticeDemoCanvas({ script, step, className }: PracticeDemoCanvasProps) {
  const { t, i18n } = useTranslation()
  const locale = toBlockLocale(i18n.resolvedLanguage ?? i18n.language)
  const theme = useBlocklyTheme()
  const workspaceRef = useRef<BlocklyWorkspaceHandle>(null)

  // Runs after BlocklyWorkspace's own injection (child effects first), and on
  // every step or language change. It also runs *before* ProblemScreen's
  // useBlocklyLocale reacts to a switch (parent effects last), so it applies
  // the locale itself — idempotent — for the blocks to rebuild with the new
  // labels.
  useEffect(() => {
    const workspace = workspaceRef.current?.getWorkspace()
    if (!workspace) return
    applyBlocklyLocale(locale)
    Blockly.Events.disable()
    try {
      workspace.clear()
      Blockly.serialization.workspaces.load(demoStepState(script, step), workspace)
    } finally {
      Blockly.Events.enable()
    }
    for (const id of revealedAt(script, step)) workspace.highlightBlock(id, true)
    workspace.scrollCenter()
  }, [script, step, locale])

  return (
    <BlocklyWorkspace
      ref={workspaceRef}
      theme={theme}
      options={demoOptions}
      testId="practice-demo-canvas"
      label={t('practice.demo.canvasLabel')}
      className={className}
    />
  )
}

export type PracticeDemoControlsProps = {
  script: DemoScript
  step: number
  onPrev: () => void
  onNext: () => void
  onExit: () => void
  className?: string
}

/**
 * Takes the ActionsBar's place while the demo runs (#212): Executar and
 * Limpar would act blind on the participant's hidden canvas, so they go.
 */
export function PracticeDemoControls({
  script,
  step,
  onPrev,
  onNext,
  onExit,
  className,
}: PracticeDemoControlsProps) {
  const { t } = useTranslation()
  const total = script.steps.length
  const textKey = script.steps[step]?.textKey ?? ''

  return (
    <div
      data-testid="practice-demo-controls"
      className={cn('flex shrink-0 flex-col gap-3 border-t pt-4', className)}
    >
      <div className="flex flex-col gap-1">
        <span
          data-testid="practice-demo-position"
          className="font-medium text-muted-foreground text-sm"
        >
          {t('practice.demo.position', { current: step + 1, total })}
        </span>
        <p data-testid="practice-demo-step-text" aria-live="polite" className="text-sm">
          {t(textKey)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="practice-demo-prev"
          disabled={step <= 0}
          onClick={onPrev}
        >
          <ChevronLeft aria-hidden="true" />
          {t('practice.demo.prev')}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="practice-demo-next"
          disabled={step >= total - 1}
          onClick={onNext}
        >
          {t('practice.demo.next')}
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="ml-auto"
          data-testid="practice-demo-exit"
          onClick={onExit}
        >
          <X aria-hidden="true" />
          {t('practice.demo.exit')}
        </Button>
      </div>
    </div>
  )
}
