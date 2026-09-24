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
import { validateVariableName } from '@/lib/variable-name'

type ErrorMessage = { key: 'empty' } | { key: 'duplicate'; name: string }

export type CreateVariableDialogProps = {
  /** The workspace the new variable goes into; the dialog is open while set. */
  workspace: Blockly.Workspace | null
  onClose: () => void
}

/**
 * The app's own "Criar variável..." dialog (#205), replacing Blockly's prompt.
 * Same rules as Blockly (see `validateVariableName`), but a refusal is shown
 * here, in the dialog, instead of Blockly's silent cancel or second alert.
 * Creation goes through the same `createVariable(name, '')` call Blockly
 * makes, so the `VarCreate` event, autosave and the flyout refresh are the
 * ones the editor already relies on.
 */
export function CreateVariableDialog({ workspace, onClose }: CreateVariableDialogProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<ErrorMessage | null>(null)

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
    if (!workspace) {
      giveBackFocus()
      return
    }
    setName('')
    setError(null)
  }, [workspace, giveBackFocus])

  useEffect(() => giveBackFocus, [giveBackFocus])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!workspace) return
    const result = validateVariableName(name, workspace)
    if (!result.ok) {
      setError(
        result.reason === 'duplicate'
          ? { key: 'duplicate', name: result.existing }
          : { key: 'empty' },
      )
      return
    }
    workspace.getVariableMap().createVariable(result.name, '')
    onClose()
  }

  return (
    <Dialog
      open={workspace !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        ref={contentRef}
        data-testid="create-variable-dialog"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          // Not prevented: Radix still moves focus on to the input.
          if (contentRef.current && !giveBackFocusRef.current) {
            giveBackFocusRef.current = Blockly.getFocusManager().takeEphemeralFocus(
              contentRef.current,
            )
          }
        }}
        // Blockly puts focus back where it was (the flyout) on give-back.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display font-semibold text-2xl">
            {t('editor.createVariable.title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>{t('editor.createVariable.label')}</Label>
            <Input
              id={inputId}
              data-testid="create-variable-input"
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
              <p
                role="alert"
                data-testid="create-variable-error"
                className="text-destructive text-sm"
              >
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
              data-testid="create-variable-cancel"
              onClick={onClose}
            >
              {t('editor.createVariable.cancel')}
            </Button>
            <Button type="submit" data-testid="create-variable-confirm">
              {t('editor.createVariable.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
