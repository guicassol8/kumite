// Always the main `blockly` entrypoint, never `blockly/core`: under the `node`
// condition the subpath resolves to CJS whose namespace import drops the named
// exports (`Blockly.common` comes back undefined). See blocks/AGENTS.md.
import * as Blockly from 'blockly'
import { javascriptGenerator, Order } from 'blockly/javascript'

import { type BlockLocale, DEFAULT_LOCALE, messagesFor } from './messages'

export const ROOT_BLOCK_TYPE = 'kumite_solve'
export const INPUT_BLOCK_TYPE = 'kumite_input'

/** Contract with #4 and #20: the generated code is always `solve(input)`. */
export const SOLUTION_FUNCTION_NAME = 'solve'
export const SOLUTION_PARAM_NAME = 'input'

/**
 * Registers the two kumite blocks and their JS generators. Idempotent by
 * construction — assigning into `Blockly.Blocks` re-registers instead of
 * throwing, so #57 can call it again with another locale to relabel.
 */
export function defineKumiteBlocks(locale: BlockLocale = DEFAULT_LOCALE): void {
  const messages = messagesFor(locale)

  Blockly.Blocks[ROOT_BLOCK_TYPE] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(messages.solveTitle)
      this.appendStatementInput('BODY')
      this.appendValueInput('RETURN').appendField(messages.solveReturn)
      // No previous/next connection: the block is the root by construction.
      // Making it fixed, undeletable and unique in the editor is #4.
      this.setColour(230)
      this.setTooltip(messages.solveTooltip)
    },
  }

  Blockly.Blocks[INPUT_BLOCK_TYPE] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(messages.inputTitle)
      this.setOutput(true)
      this.setColour(330)
      this.setTooltip(messages.inputTooltip)
    },
  }

  javascriptGenerator.forBlock[ROOT_BLOCK_TYPE] = (block, generator) => {
    const body = generator.statementToCode(block, 'BODY')
    const value = generator.valueToCode(block, 'RETURN', Order.NONE) || 'null'
    return `function ${SOLUTION_FUNCTION_NAME}(${SOLUTION_PARAM_NAME}) {\n${body}  return ${value};\n}\n`
  }

  // The parameter name is the code contract, not the localized label.
  javascriptGenerator.forBlock[INPUT_BLOCK_TYPE] = () => [SOLUTION_PARAM_NAME, Order.ATOMIC]
}
