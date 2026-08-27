export { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
// Also reachable on its own as `@kumite/blocks/contract`, for the bundles that
// must not drag Blockly in — see `./contract`.
export { SOLUTION_FUNCTION_NAME, SOLUTION_PARAM_NAME } from './contract'
export { BlocksError, type BlocksErrorCode } from './errors'
export { somaDosPares } from './fixtures/soma-dos-pares'
export { generateSolution } from './generate'
export {
  type BlockLocale,
  type BlockMessages,
  DEFAULT_LOCALE,
  messagesFor,
} from './messages'
export {
  allowedBlockTypes,
  buildToolbox,
  CREATE_VARIABLE_BUTTON_KEY,
  emptyWorkspaceState,
  VARIABLES_CATEGORY_KEY,
  variablesFlyout,
  type WorkspaceState,
  withRootBlock,
} from './toolbox'
