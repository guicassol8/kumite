import {
  type BlockLocale,
  buildToolbox,
  CREATE_VARIABLE_BUTTON_KEY,
  defineKumiteBlocks,
  ROOT_BLOCK_TYPE,
  VARIABLES_CATEGORY_KEY,
  variablesFlyout,
} from '@kumite/blocks'
import * as Blockly from 'blockly'
import * as en from 'blockly/msg/en'
import * as es from 'blockly/msg/es'
import * as ptBr from 'blockly/msg/pt-br'

import {
  installVariableField,
  setVariableDialogHandler,
  type VariableDialogHandler,
} from '@/lib/blockly-variable-field'

/**
 * Single entry point for the editor's Blockly configuration.
 *
 * Two layers of language meet here and neither belongs to the other: Blockly's
 * own blocks ("if", "repeat") are translated by the official locale packs,
 * which live in the front (#57); the kumite blocks and the category names come
 * from `@kumite/blocks`.
 */
const BLOCKLY_MESSAGE_PACKS: Record<BlockLocale, Record<string, string>> = {
  // The locale pack is a flat bag of message strings, but the namespace import
  // also carries the synthetic `default` that esModuleInterop adds, which
  // `setLocale`'s `{[key: string]: string}` rejects. Blockly's own docs use
  // this import, so the cast is on the interop, not on the data.
  pt: ptBr as unknown as Record<string, string>,
  es: es as unknown as Record<string, string>,
  en: en as unknown as Record<string, string>,
}

const BLOCK_DISABLE_ITEM_ID = 'blockDisable'
let noManualDisableInstalled = false

/**
 * Hides Blockly's "Disable block" from the block context menu (#239). A
 * disabled block in the solution is refused by `generateSolution` with
 * `disabled-block` (#181) — that refusal is the trust boundary and stays —
 * so offering the action only leads the participant into a state that exists
 * to be rejected.
 *
 * `options.disable: false` would hide the item too, but it also takes away
 * "Enable block", leaving a block disabled before this change (an old
 * autosave, a forged workspace) with no way back, while the `disabled-block`
 * message tells the participant to re-enable it. So the item stays registered
 * and only its precondition changes: hidden on any block that is not already
 * manually disabled, Blockly's own rule otherwise.
 *
 * Global to the registry, so once per page; it runs at module load.
 */
export function installNoManualDisable(): void {
  if (noManualDisableInstalled) return
  const registry = Blockly.ContextMenuRegistry.registry
  const original = registry.getItem(BLOCK_DISABLE_ITEM_ID)
  if (!original || !('preconditionFn' in original) || !original.preconditionFn) return
  const originalPrecondition = original.preconditionFn
  noManualDisableInstalled = true

  registry.unregister(BLOCK_DISABLE_ITEM_ID)
  registry.register({
    ...original,
    preconditionFn(scope, menuOpenEvent) {
      if (!scope.block?.hasDisabledReason(Blockly.constants.MANUALLY_DISABLED)) return 'hidden'
      return originalPrecondition(scope, menuOpenEvent)
    },
  })
}

installNoManualDisable()
// Variable dropdowns hand "rename" and "delete" to the app's dialogs (#335).
installVariableField()

/**
 * Applies a locale to both the native Blockly blocks and the kumite blocks,
 * and returns the toolbox for it. Both `Blockly.setLocale` and
 * `defineKumiteBlocks` are idempotent, so this is safe to call again whenever
 * the active UI language changes (#57).
 */
export function applyBlocklyLocale(locale: BlockLocale): Blockly.utils.toolbox.ToolboxDefinition {
  Blockly.setLocale(BLOCKLY_MESSAGE_PACKS[locale])
  defineKumiteBlocks(locale)
  return buildToolbox(locale)
}

/**
 * The root block is unique per workspace: `setDeletable(false)` keeps the one
 * that is there, `maxInstances` keeps a second one from ever arriving.
 */
export const workspaceOptions: Partial<Blockly.BlocklyOptions> = {
  maxInstances: { [ROOT_BLOCK_TYPE]: 1 },
}

/**
 * Wires the dynamic Variables category to the injected workspace: the flyout
 * contents and the "create variable" button both live on the workspace, not on
 * the toolbox definition, so this runs once per injected workspace (and again
 * whenever the locale changes, to relabel the flyout).
 *
 * The button opens the app's own dialog through `onVariableDialog` instead of
 * `Blockly.Variables.createVariableButtonHandler` (#205): Blockly's prompt
 * cannot refuse an empty or duplicate name inside itself. The variable
 * dropdowns' "rename" and "delete" reach the same callback, through the
 * handler registered here on the workspace (#335, `blockly-variable-field`).
 */
export function registerVariablesFlyout(
  workspace: Blockly.WorkspaceSvg | null | undefined,
  locale: BlockLocale,
  onVariableDialog: VariableDialogHandler,
): void {
  if (!workspace) return

  setVariableDialogHandler(workspace, onVariableDialog)

  workspace.registerToolboxCategoryCallback(VARIABLES_CATEGORY_KEY, (target) =>
    variablesFlyout(target, locale),
  )
  workspace.registerButtonCallback(CREATE_VARIABLE_BUTTON_KEY, (button) => {
    onVariableDialog({ kind: 'create', workspace: button.getTargetWorkspace() })
  })
}
