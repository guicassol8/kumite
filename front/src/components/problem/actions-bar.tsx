import { Lightbulb, Play, Send, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ActionsBarProps = {
  isRunning: boolean
  onRun: () => void
  onClear: () => void
  isClosed: boolean
  isSubmitting?: boolean
  // The organizer paused submissions (#285): Submeter goes inert, Executar
  // and Limpar keep working.
  isPaused?: boolean
  // Absent in practice (#211): no submission exists there, so no Submeter.
  onSubmit?: () => void
  // Present only on a practice problem with a demo script (#212): "Ver como
  // se resolve".
  onShowDemo?: () => void
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
  isSubmitting = false,
  isPaused = false,
  onSubmit,
  onShowDemo,
  className,
}: ActionsBarProps) {
  const { t } = useTranslation()
  // Limpar asks in the app's own dialog (#283): `window.confirm` sat outside
  // the identity, never translated its OK/Cancel, and blocked browser
  // automation.
  const [confirmingClear, setConfirmingClear] = useState(false)
  const closedHintId = useId()

  return (
    <div
      data-testid="problem-actions-bar"
      className={cn(
        'flex shrink-0 items-center gap-2 border-t pt-4',
        // Lets the closed-round hint drop to its own line on a phone instead
        // of squeezing into a column beside the two buttons.
        isClosed && 'flex-wrap',
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        data-testid="problem-run-button"
        aria-describedby={isClosed ? closedHintId : undefined}
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
        onClick={() => setConfirmingClear(true)}
      >
        <Trash2 aria-hidden="true" />
        {t('problem.clearButton')}
      </Button>
      <AlertDialog open={confirmingClear} onOpenChange={setConfirmingClear}>
        <AlertDialogContent data-testid="problem-clear-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-semibold text-2xl">
              {t('problem.clearDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('problem.clearDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="problem-clear-cancel">
              {t('problem.clearDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="problem-clear-confirm"
              onClick={onClear}
            >
              {t('problem.clearDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {onShowDemo && (
        // Right edge, where Submeter sits on a round problem: practice never
        // has both.
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          data-testid="practice-demo-start"
          onClick={onShowDemo}
        >
          <Lightbulb aria-hidden="true" />
          {t('practice.demo.start')}
        </Button>
      )}
      {onSubmit && !isClosed && (
        // The one filled brand-red button of the screen, pushed to the right
        // edge of the bar (identity § 5: "marca (vermelho, um por tela)").
        <Button
          type="button"
          className="ml-auto bg-brand text-brand-foreground hover:bg-brand-hover"
          data-testid="problem-submit-button"
          disabled={isSubmitting || isPaused}
          onClick={onSubmit}
        >
          <Send aria-hidden="true" />
          {isSubmitting ? t('problem.submitProgress') : t('problem.submitButton')}
        </Button>
      )}
      {isClosed && (
        // #200.2: Executar keeps working once the round closes, and nothing
        // said it no longer counts. Quiet text where Submeter used to sit. On
        // a phone (< 640px wide) 700px tall or less it wraps to an extra line
        // that came out of the results band (#155), so there it is for screen
        // readers only — Executar's aria-describedby still names it. A short
        // laptop keeps it: there it sits on the buttons' line for free.
        <p
          id={closedHintId}
          className="ml-auto flex-[1_1_14rem] text-right text-muted-foreground text-xs max-sm:short:sr-only"
          data-testid="problem-run-closed-hint"
        >
          {t('problem.closedRound.runHint')}
        </p>
      )}
    </div>
  )
}
