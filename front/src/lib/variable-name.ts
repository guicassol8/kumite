import * as Blockly from 'blockly'

export type VariableNameResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'duplicate'; existing: string }

/**
 * The rules Blockly's own "create variable" prompt applies (#205), run up
 * front so our dialog can refuse inside itself instead of Blockly's silent
 * cancel (empty) or its separate `dialog.alert` (duplicate).
 *
 * Normalization mirrors `Blockly.Variables.promptName`: runs of whitespace
 * and non-breaking spaces collapse to one space, then trim. Duplicates use
 * `nameUsedWithAnyType`, which ignores case and variable type — same as
 * `createVariableButtonHandler`.
 *
 * Renaming (#335) passes `except`, the id of the variable being renamed: its
 * own name is not a conflict, so "x" → "X" goes through, as in Blockly. Any
 * *other* variable's name is refused, even one of the same type — where
 * Blockly would silently merge the two variables.
 */
export function validateVariableName(
  raw: string,
  workspace: Blockly.Workspace,
  { except }: { except?: string } = {},
): VariableNameResult {
  const name = raw.replace(/[\s\xa0]+/g, ' ').trim()
  if (!name) return { ok: false, reason: 'empty' }

  const existing = Blockly.Variables.nameUsedWithAnyType(name, workspace)
  if (existing && existing.getId() !== except) {
    return { ok: false, reason: 'duplicate', existing: existing.getName() }
  }

  return { ok: true, name }
}
