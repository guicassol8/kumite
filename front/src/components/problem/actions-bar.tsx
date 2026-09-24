import { Play, Send, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ActionsBarProps = {
  isRunning: boolean
  onRun: () => void
  onClear: () => void
  isClosed: boolean
  isSubmitting: boolean
  // The organizer paused submissions (#285): Submeter goes inert, Executar
  // and Limpar keep working.
  isPaused?: boolean
  onSubmit: () => void
  className?: string
}

/**
 * Executar/Limpar/Submeter — extracted verbatim from `/problem/$id` (#203).
 * Whatever collapses around it (T7/T8), this bar itself never does: it is
 * what keeps the three actions reachable.
 */
export function ActionsBar({
  isRunning,
  onRun,
  onClear,
  isClosed,
  isSubmitting,
  isPaused = false,
  onSubmit,
  className,
}: ActionsBarProps) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="problem-actions-bar"
      className={cn('flex shrink-0 items-center gap-2 border-t pt-4', className)}
    >
      <Button
        type="button"
        variant="outline"
        data-testid="problem-run-button"
        disabled={isRunning}
        onClick={onRun}
      >
        <Play aria-hidden="true" />
        {isRunning ? t('problem.executeRunning') : t('problem.executeButton')}
      </Button>
      {/* Crimson TEXT, not the generic `destructive` outline: identity § 5
          allows one red button per screen and that one is Submeter. The
          Button's own `destructive` variant is untouched — this is the only
          call site that opts out of it. */}
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        data-testid="problem-clear-button"
        onClick={() => {
          if (!window.confirm(t('problem.clearConfirm'))) return
          onClear()
        }}
      >
        <Trash2 aria-hidden="true" />
        {t('problem.clearButton')}
      </Button>
      {!isClosed && (
        // The one filled brand-red button of the screen, pushed to the right
        // edge of the bar (identity § 5: "marca (vermelho, um por tela)").
        <Button
          type="button"
          className="ml-auto bg-brand text-brand-foreground shadow-none hover:bg-brand-hover"
          data-testid="problem-submit-button"
          disabled={isSubmitting || isPaused}
          onClick={onSubmit}
        >
          <Send aria-hidden="true" />
          {isSubmitting ? t('problem.submitProgress') : t('problem.submitButton')}
        </Button>
      )}
    </div>
  )
}
