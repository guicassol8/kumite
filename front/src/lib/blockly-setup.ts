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
 */
export function registerVariablesFlyout(
  workspace: Blockly.WorkspaceSvg | null | undefined,
  locale: BlockLocale,
): void {
  if (!workspace) return

  workspace.registerToolboxCategoryCallback(VARIABLES_CATEGORY_KEY, (target) =>
    variablesFlyout(target, locale),
  )
  workspace.registerButtonCallback(CREATE_VARIABLE_BUTTON_KEY, (button) => {
    Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace())
  })
}
