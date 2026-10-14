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
import { type DeleteAllRequest, deleteAllDeletable } from '@/lib/blockly-delete-all'

export type DeleteBlocksDialogProps = {
  /** The canvas's "Delete N blocks"; the dialog is open while set. */
  request: DeleteAllRequest | null
  onClose: () => void
}

/**
 * The app's own confirmation for the canvas context menu's "Delete N blocks"
 * (#445), replacing Blockly's `dialog.confirm` ("Delete all %1 blocks?").
 * Nothing changes until Confirm: Cancel and Escape just close.
 *
 * The count is always 2 or more — a single block is deleted with no question,
 * like Blockly does (`installDeleteAllConfirm`) — so the title needs no plural.
 */
export function DeleteBlocksDialog({ request, onClose }: DeleteBlocksDialogProps) {
  const { t } = useTranslation()
  // Keeps the last request through the closing animation, so the count does
  // not go blank while the dialog fades out.
  const [shown, setShown] = useState(request)
  if (request && request !== shown) setShown(request)
  const current = request ?? shown

  // No `onClose` here: the Action closes the dialog itself, through
  // `onOpenChange`, like Cancel and Escape.
  function handleConfirm() {
    if (request) deleteAllDeletable(request.workspace)
  }

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent data-testid="delete-blocks-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display font-semibold text-2xl">
            {t('editor.deleteBlocks.title', { blocks: current?.blocks })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('editor.deleteBlocks.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-blocks-cancel">
            {t('editor.deleteBlocks.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            data-testid="delete-blocks-confirm"
            onClick={handleConfirm}
          >
            {t('editor.deleteBlocks.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
