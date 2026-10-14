import * as Blockly from 'blockly'

/**
 * What the canvas's "Delete N blocks" asks the app to confirm (#445): the
 * workspace, and how many blocks would go — the same N as the menu item,
 * always 2 or more.
 */
export type DeleteAllRequest = { workspace: Blockly.WorkspaceSvg; blocks: number }

export type DeleteAllHandler = (request: DeleteAllRequest) => void

const WORKSPACE_DELETE_ITEM_ID = 'workspaceDelete'
const handlers = new WeakMap<Blockly.Workspace, DeleteAllHandler>()
let installed = false

/** Routes this workspace's "Delete N blocks" confirmation to the app's dialog. */
export function setDeleteAllHandler(
  workspace: Blockly.WorkspaceSvg,
  handler: DeleteAllHandler,
): void {
  handlers.set(workspace, handler)
}

/**
 * Every block "Delete N blocks" takes, in Blockly's own order
 * (`getDeletableBlocks_` in `core/contextmenu_items.ts`): a deletable top
 * block with all its descendants; under one that is not (the "resolver"
 * root), the search goes on in its children.
 */
export function deletableBlocks(workspace: Blockly.WorkspaceSvg): Blockly.BlockSvg[] {
  const list: Blockly.BlockSvg[] = []
  const visit = (block: Blockly.BlockSvg) => {
    if (block.isDeletable()) {
      list.push(...block.getDescendants(false))
      return
    }
    for (const child of block.getChildren(false)) visit(child)
  }
  for (const top of workspace.getTopBlocks(true)) visit(top)
  return list
}

/**
 * Deletes every deletable block, the root stays — what Blockly's `deleteNext_`
 * does, in one event group so a single undo brings them all back. The list is
 * taken now, not when the dialog opened: a language switch reloads the
 * workspace under the open dialog. Blockly paces its deletes 10 ms apart for
 * the effect; here they all go at once.
 */
export function deleteAllDeletable(workspace: Blockly.WorkspaceSvg): void {
  const blocks = deletableBlocks(workspace)
  if (blocks.length === 0) return
  Blockly.Events.setGroup(true)
  try {
    // A descendant of a block already deleted goes with it.
    for (const block of blocks) {
      if (!block.isDeadOrDying()) block.dispose(false, true)
    }
  } finally {
    Blockly.Events.setGroup(false)
  }
}

/**
 * The canvas context menu's "Delete N blocks" asks the app instead of
 * `Blockly.dialog.confirm` (#445), whose `<dialog class="blocklyDialog">` is
 * outside the identity, untranslated and in the way of browser automation.
 * `Blockly.dialog.setConfirm` is no way in: it is global. So the registered
 * item keeps its id, text, precondition and weight, and only its callback
 * changes — the way `installNoManualDisable` swaps a precondition (#239).
 *
 * The rule for asking stays Blockly's: a single deletable block goes at once,
 * with no question. That, and a workspace with no handler (the read-only
 * practice demo), fall through to Blockly's own callback.
 *
 * Global to the registry, so once per page; the editor's module runs it at
 * load. The menu has already closed when the callback runs, so the dialog
 * opens with no focus to fight for.
 */
export function installDeleteAllConfirm(): void {
  if (installed) return
  const registry = Blockly.ContextMenuRegistry.registry
  const original = registry.getItem(WORKSPACE_DELETE_ITEM_ID)
  if (!original || original.separator) return
  const originalCallback = original.callback
  installed = true

  const callback: typeof originalCallback = (scope, ...rest) => {
    const workspace = scope.workspace
    const handler = workspace && handlers.get(workspace)
    const blocks = workspace && handler ? deletableBlocks(workspace).length : 0
    if (!workspace || !handler || blocks < 2) {
      originalCallback(scope, ...rest)
      return
    }
    workspace.cancelCurrentGesture()
    handler({ workspace, blocks })
  }

  registry.unregister(WORKSPACE_DELETE_ITEM_ID)
  registry.register({ ...original, callback })
}
