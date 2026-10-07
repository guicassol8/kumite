import * as Blockly from 'blockly'

/**
 * A variable dialog the editor asks the app to open: the flyout's "create
 * variable" button (#205), and the "rename" and "delete" items of a variable
 * block's dropdown (#335).
 *
 * `uses` is every block a delete takes with it, the clicked one included —
 * Blockly's own `%1` in "Delete %1 uses of the '%2' variable?".
 */
export type VariableDialogRequest =
  | { kind: 'create'; workspace: Blockly.Workspace }
  | { kind: 'rename'; workspace: Blockly.Workspace; variableId: string; name: string }
  | {
      kind: 'delete'
      workspace: Blockly.Workspace
      variableId: string
      name: string
      uses: number
    }

export type VariableDialogHandler = (request: VariableDialogRequest) => void

const handlers = new WeakMap<Blockly.Workspace, VariableDialogHandler>()

/** Routes this workspace's variable dropdowns to the app's dialogs. */
export function setVariableDialogHandler(
  workspace: Blockly.Workspace,
  handler: VariableDialogHandler,
): void {
  handlers.set(workspace, handler)
}

/**
 * Blockly's variable field, with "Rename variable…" and "Delete the '%1'
 * variable" handed to the app (#335). Blockly runs them through
 * `Blockly.dialog.prompt` / `confirm`, which cannot refuse a name inside the
 * dialog (and a same-type name would silently merge two variables), and look
 * nothing like the app. `Blockly.dialog.setPrompt` is no way in either: it is
 * global, and `FieldInput` uses the same prompt for modal inputs on touch.
 *
 * The field is the one extension point that is per item: `FieldDropdown`
 * closes the dropdown synchronously, then calls `onItemSelected_` — so by the
 * time the app's dialog opens, the dropdown has already given its ephemeral
 * focus back.
 *
 * Anything else falls through to Blockly: picking another variable, a
 * workspace with no handler (the read-only practice demo), a block on its way
 * out, and a delete whose only use is the clicked block (Blockly deletes that
 * at once, with no question).
 */
export class KumiteFieldVariable extends Blockly.FieldVariable {
  protected override onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem): void {
    const id = menuItem.getValue()
    const block = this.getSourceBlock()
    const variable = this.getVariable()
    const special = id === Blockly.RENAME_VARIABLE_ID || id === Blockly.DELETE_VARIABLE_ID
    const workspace = variable?.getWorkspace()
    const handler = workspace && handlers.get(workspace)

    if (!special || !block || block.isDeadOrDying() || !variable || !workspace || !handler) {
      super.onItemSelected_(menu, menuItem)
      return
    }

    const target = { workspace, variableId: variable.getId(), name: variable.getName() }
    if (id === Blockly.RENAME_VARIABLE_ID) {
      handler({ kind: 'rename', ...target })
      return
    }

    const others = Blockly.Variables.getVariableUsesById(workspace, variable.getId()).filter(
      (use) => use !== block,
    ).length
    if (others === 0) {
      super.onItemSelected_(menu, menuItem)
      return
    }
    // Same count as Blockly's confirm: a block in a flyout is not one of the uses.
    handler({ kind: 'delete', ...target, uses: others + (block.workspace.isFlyout ? 0 : 1) })
  }
}

/**
 * Puts `KumiteFieldVariable` in the registry under `field_variable`, so every
 * block built from JSON — `variables_get`, `variables_set`,
 * `controls_forEach` — gets it (`FieldVariable.fromJson` builds `new this`).
 * Serialization and codegen do not change: the field's JSON and state are
 * Blockly's. No block or toolbox is defined here, and the back never loads it.
 *
 * Global to the registry, so once per page; `blockly-setup` runs it at module
 * load, before any workspace exists.
 */
export function installVariableField(): void {
  const current = Blockly.registry.getClass(Blockly.registry.Type.FIELD, 'field_variable')
  if (current === KumiteFieldVariable) return
  Blockly.fieldRegistry.unregister('field_variable')
  Blockly.fieldRegistry.register('field_variable', KumiteFieldVariable)
}
