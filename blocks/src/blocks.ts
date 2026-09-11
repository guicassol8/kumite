// Always the main `blockly` entrypoint, never `blockly/core`: under the `node`
// condition the subpath resolves to CJS whose namespace import drops the named
// exports (`Blockly.common` comes back undefined). See blocks/AGENTS.md.
import * as Blockly from 'blockly'
import { javascriptGenerator, Order } from 'blockly/javascript'

import { SOLUTION_FUNCTION_NAME, SOLUTION_PARAM_NAME } from './contract'
import { type BlockLocale, DEFAULT_LOCALE, messagesFor } from './messages'

export const ROOT_BLOCK_TYPE = 'kumite_solve'
export const INPUT_BLOCK_TYPE = 'kumite_input'

/**
 * Guards the one part of `defineKumiteBlocks` that is not idempotent.
 * `addReservedWords` is `RESERVED_WORDS_ += words + ','`: it appends
 * unconditionally, and this function runs on every `generateSolution` call, so
 * without this the list would grow by two entries per codegen for the life of
 * the process — and `init()` re-splits the whole string every time.
 */
let reservedNamesRegistered = false

/**
 * Registers the two kumite blocks and their JS generators. Idempotent by
 * construction — assigning into `Blockly.Blocks` re-registers instead of
 * throwing, so #57 can call it again with another locale to relabel.
 */
export function defineKumiteBlocks(locale: BlockLocale = DEFAULT_LOCALE): void {
  const messages = messagesFor(locale)

  // The generator already reserves every ECMAScript keyword and every name on
  // `globalThis`, but not the two the solution contract owns. Without this, a
  // participant variable named `input` *is* the `solve` parameter — same
  // binding, no error, wrong answer (#181, finding #8). Derived from
  // `contract.ts` so the day the contract changes this follows it. Registered
  // once per process: only `init()` reads the list, and it reads all of it.
  if (!reservedNamesRegistered) {
    javascriptGenerator.addReservedWords(`${SOLUTION_FUNCTION_NAME},${SOLUTION_PARAM_NAME}`)
    reservedNamesRegistered = true
  }

  Blockly.Blocks[ROOT_BLOCK_TYPE] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(messages.solveTitle)
      this.appendStatementInput('BODY')
      this.appendValueInput('RETURN').appendField(messages.solveReturn)
      // No previous/next connection: the block is the root by construction.
      // `setDeletable(false)` is the whole protection: the `preconditionFn` of
      // Blockly 13's `blockDelete` and `blockDuplicate` context-menu items, the
      // Delete/Backspace and cut shortcuts and the trashcan all go through
      // `isDeletable()`, so one call closes deleting, duplicating, cutting and
      // dragging to the trash. The block stays movable on purpose.
      // Uniqueness is the editor's side: `maxInstances` on `Blockly.inject`.
      this.setDeletable(false)
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
