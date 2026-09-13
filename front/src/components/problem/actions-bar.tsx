import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ActionsBarProps = {
  isRunning: boolean
  onRun: () => void
  onClear: () => void
  isClosed: boolean
  isSubmitting: boolean
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
  onSubmit,
  className,
}: ActionsBarProps) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="problem-actions-bar"
      className={cn('flex shrink-0 items-center gap-2 border-t pt-4', className)}
    >
      <Button type="button" data-testid="problem-run-button" disabled={isRunning} onClick={onRun}>
        {isRunning ? t('problem.executeRunning') : t('problem.executeButton')}
      </Button>
      <Button
        type="button"
        variant="destructive"
        data-testid="problem-clear-button"
        onClick={() => {
          if (!window.confirm(t('problem.clearConfirm'))) return
          onClear()
        }}
      >
        {t('problem.clearButton')}
      </Button>
      {!isClosed && (
        <Button
          type="button"
          data-testid="problem-submit-button"
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? t('problem.submitProgress') : t('problem.submitButton')}
        </Button>
      )}
    </div>
  )
}
