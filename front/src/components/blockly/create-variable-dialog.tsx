import type * as Blockly from 'blockly'
import { type FormEvent, useEffect, useId, useState } from 'react'
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

  // Every opening starts over: empty input, no stale error.
  useEffect(() => {
    if (!workspace) return
    setName('')
    setError(null)
  }, [workspace])

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
      <DialogContent data-testid="create-variable-dialog" showCloseButton={false}>
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
              autoComplete="off"
              autoFocus
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
