import * as Blockly from 'blockly'
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { VariableDialogRequest } from '@/lib/blockly-variable-field'
import { validateVariableName } from '@/lib/variable-name'

type ErrorMessage = { key: 'empty' } | { key: 'duplicate'; name: string }

export type VariableNameDialogProps = {
  /** What to name: a new variable, or an existing one to rename. The dialog
   * is open while set. */
  request: Extract<VariableDialogRequest, { kind: 'create' | 'rename' }> | null
  onClose: () => void
}

/**
 * The app's own dialog for naming a variable, replacing Blockly's prompt in
 * "Criar variável..." (#205) and in a variable dropdown's "Renomear
 * variável..." (#335). Same rules as Blockly (see `validateVariableName`), but
 * a refusal is shown here, in the dialog, instead of Blockly's silent cancel
 * or second alert — and renaming to another variable's name is refused rather
 * than merging the two.
 *
 * The change goes through the same calls Blockly makes —
 * `createVariable(name, '')` and `renameVariable(variable, name)` — so the
 * variable events, autosave and the flyout refresh are the ones the editor
 * already relies on.
 */
export function VariableNameDialog({ request, onClose }: VariableNameDialogProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<ErrorMessage | null>(null)

  // Keeps the last request through the closing animation, so the title and
  // the test ids do not flip to "create" while the dialog fades out.
  const [shown, setShown] = useState(request)
  if (request && request !== shown) setShown(request)
  const current = request ?? shown
  const isRename = current?.kind === 'rename'
  const testId = isRename ? 'rename-variable' : 'create-variable'
  const copy = isRename ? 'editor.renameVariable' : 'editor.createVariable'

  const contentRef = useRef<HTMLDivElement>(null)
  // Focus moving into this dialog is, to Blockly, the editor losing focus —
  // and it closes the open flyout on that. Blockly's own prompt avoids it by
  // taking *ephemeral* focus for as long as it is open; so does this one.
  const giveBackFocusRef = useRef<Blockly.ReturnEphemeralFocus | null>(null)
  const giveBackFocus = useCallback(() => {
    const giveBack = giveBackFocusRef.current
    giveBackFocusRef.current = null
    giveBack?.()
  }, [])

  // Every opening starts over: empty input, no stale error.
  useEffect(() => {
    if (!request) {
      giveBackFocus()
      return
    }
    setName('')
    setError(null)
  }, [request, giveBackFocus])

  useEffect(() => giveBackFocus, [giveBackFocus])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!request) return
    const { workspace } = request
    const except = request.kind === 'rename' ? request.variableId : undefined
    const result = validateVariableName(name, workspace, { except })
    if (!result.ok) {
      setError(
        result.reason === 'duplicate'
          ? { key: 'duplicate', name: result.existing }
          : { key: 'empty' },
      )
      return
    }

    const variables = workspace.getVariableMap()
    if (request.kind === 'create') {
      variables.createVariable(result.name, '')
    } else {
      // Looked up by id now, not held from the request: a language switch
      // reloads the workspace under the open dialog, with the same ids.
      const variable = variables.getVariableById(request.variableId)
      if (variable && variable.getName() !== result.name) {
        variables.renameVariable(variable, result.name)
      }
    }
    onClose()
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        ref={contentRef}
        data-testid={`${testId}-dialog`}
        showCloseButton={false}
        onOpenAutoFocus={() => {
          // Not prevented: Radix still moves focus on to the input.
          if (contentRef.current && !giveBackFocusRef.current) {
            giveBackFocusRef.current = Blockly.getFocusManager().takeEphemeralFocus(
              contentRef.current,
            )
          }
        }}
        // Blockly puts focus back where it was (the flyout, the block) on
        // give-back.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display font-semibold text-2xl">
            {isRename ? t(`${copy}.title`, { name: current.name }) : t(`${copy}.title`)}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>{t(`${copy}.label`)}</Label>
            <Input
              id={inputId}
              data-testid={`${testId}-input`}
              className="h-11"
              // No autoFocus: Radix focuses this first field itself, and an
              // input already focused would skip onOpenAutoFocus above.
              autoComplete="off"
              value={name}
              aria-invalid={error !== null}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
            />
            {error && (
              <p role="alert" data-testid={`${testId}-error`} className="text-destructive text-sm">
                {/* Same refusals whether creating or renaming. */}
                {error.key === 'duplicate'
                  ? t('editor.createVariable.errors.duplicate', { name: error.name })
                  : t('editor.createVariable.errors.empty')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid={`${testId}-cancel`}
              onClick={onClose}
            >
              {t(`${copy}.cancel`)}
            </Button>
            <Button type="submit" data-testid={`${testId}-confirm`}>
              {t(`${copy}.confirm`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
