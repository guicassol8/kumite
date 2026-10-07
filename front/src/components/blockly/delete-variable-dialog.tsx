import { useState } from 'react'
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
import type { VariableDialogRequest } from '@/lib/blockly-variable-field'

export type DeleteVariableDialogProps = {
  /** The variable in use to delete; the dialog is open while set. */
  request: Extract<VariableDialogRequest, { kind: 'delete' }> | null
  onClose: () => void
}

/**
 * The app's own confirmation for deleting a variable that other blocks still
 * use (#335), replacing Blockly's `dialog.confirm` ("Delete %1 uses of the
 * '%2' variable?"). Nothing changes until Confirm: Cancel and Escape just
 * close.
 *
 * Confirm makes the same call Blockly's confirm callback makes,
 * `getVariableMap().deleteVariable`, which disposes every use and the
 * variable in one event group — one undo brings it all back.
 */
export function DeleteVariableDialog({ request, onClose }: DeleteVariableDialogProps) {
  const { t } = useTranslation()
  // Keeps the last request through the closing animation, so the text does
  // not go blank while the dialog fades out.
  const [shown, setShown] = useState(request)
  if (request && request !== shown) setShown(request)
  const current = request ?? shown

  // No `onClose` here: the Action closes the dialog itself, through
  // `onOpenChange`, like Cancel and Escape.
  function handleConfirm() {
    if (!request) return
    // Looked up by id now, not held from the request: a language switch
    // reloads the workspace under the open dialog, with the same ids.
    const variables = request.workspace.getVariableMap()
    const variable = variables.getVariableById(request.variableId)
    if (variable) variables.deleteVariable(variable)
  }

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent data-testid="delete-variable-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display font-semibold text-2xl">
            {t('editor.deleteVariable.title', { name: current?.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('editor.deleteVariable.description', { uses: current?.uses })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-variable-cancel">
            {t('editor.deleteVariable.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            data-testid="delete-variable-confirm"
            onClick={handleConfirm}
          >
            {t('editor.deleteVariable.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
