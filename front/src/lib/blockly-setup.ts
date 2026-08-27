import {
  buildToolbox,
  CREATE_VARIABLE_BUTTON_KEY,
  defineKumiteBlocks,
  ROOT_BLOCK_TYPE,
  VARIABLES_CATEGORY_KEY,
  variablesFlyout,
} from '@kumite/blocks'
import * as Blockly from 'blockly'
import * as ptBr from 'blockly/msg/pt-br'

/**
 * Single entry point for the editor's Blockly configuration.
 *
 * Two layers of language meet here and neither belongs to the other: Blockly's
 * own blocks ("if", "repeat") are translated by the official locale packs,
 * which live in the front (#57); the kumite blocks and the category names come
 * from `@kumite/blocks`. Importing this module applies both, before any
 * workspace is injected — registration is global to Blockly, so module top is
 * the right place.
 */
const LOCALE = 'pt'

// The locale pack is a flat bag of message strings, but the namespace import
// also carries the synthetic `default` that esModuleInterop adds, which
// `setLocale`'s `{[key: string]: string}` rejects. Blockly's own docs use this
// import, so the cast is on the interop, not on the data.
Blockly.setLocale(ptBr as unknown as Record<string, string>)
defineKumiteBlocks(LOCALE)

export const toolbox = buildToolbox(LOCALE)

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
 * the toolbox definition, so this runs once per injected workspace.
 */
export function registerVariablesFlyout(workspace: Blockly.WorkspaceSvg | null | undefined): void {
  if (!workspace) return

  workspace.registerToolboxCategoryCallback(VARIABLES_CATEGORY_KEY, (target) =>
    variablesFlyout(target, LOCALE),
  )
  workspace.registerButtonCallback(CREATE_VARIABLE_BUTTON_KEY, (button) => {
    Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace())
  })
}
