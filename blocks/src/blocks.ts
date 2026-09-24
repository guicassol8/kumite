// Always the main `blockly` entrypoint, never `blockly/core`: under the `node`
// condition the subpath resolves to CJS whose namespace import drops the named
// exports (`Blockly.common` comes back undefined). See blocks/AGENTS.md.
import * as Blockly from 'blockly'
import { javascriptGenerator, Order } from 'blockly/javascript'

import { SOLUTION_FUNCTION_NAME, SOLUTION_PARAM_NAME } from './contract'
import { deniedFieldValues } from './denied'
import { type BlockLocale, DEFAULT_LOCALE, messagesFor } from './messages'
import { INPUT_BLOCK_STYLE, ROOT_BLOCK_STYLE } from './theme'

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

/** Same reason as `reservedNamesRegistered`: the stripping below wraps the
 * block's own `init`, so running it twice would wrap the wrapper. */
let deniedOptionsStripped = false

type BlockDefinition = { init?: (this: Blockly.Block) => void }

/**
 * Removes the options in `deniedFieldValues` from the blocks Blockly ships, so
 * the editor never offers them in the first place.
 *
 * It has to happen inside `init`, not on the block definition: `lists_getIndex`
 * builds its `WHERE` field once, in `init`, from `this.WHERE_OPTIONS`, and
 * `updateAt_` only ever rebuilds the `AT` input — filtering `WHERE_OPTIONS`
 * afterwards has no effect on a field that already exists. `setOptions` is the
 * public, typed way in, and it leaves the field's own validator (the one that
 * drives `updateAt_`) alone.
 *
 * Only half the defence: a serialized state can reach the judge without ever
 * passing through an editor, and Blockly loads a value the dropdown no longer
 * offers as the field's default without complaining. `generateSolution` reads
 * the raw state for exactly that reason.
 */
function stripDeniedFieldOptions(): void {
  if (deniedOptionsStripped) return
  deniedOptionsStripped = true

  for (const [type, fields] of Object.entries(deniedFieldValues)) {
    const definition = Blockly.Blocks[type] as BlockDefinition | undefined
    const original = definition?.init
    // A consumer that never loaded Blockly's standard blocks has nothing to
    // strip — and nothing to offer either, so there is no hole to plug.
    if (!original) continue

    definition.init = function stripped(this: Blockly.Block) {
      original.call(this)
      for (const [name, denied] of Object.entries(fields)) {
        const field = this.getField(name)
        if (!(field instanceof Blockly.FieldDropdown)) continue
        field.setOptions(
          field.getOptions(false).filter(([, value]) => !denied.includes(value as string)),
        )
      }
    }
  }
}

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

  stripDeniedFieldOptions()

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
      this.setStyle(ROOT_BLOCK_STYLE)
      this.setTooltip(messages.solveTooltip)
    },
  }

  Blockly.Blocks[INPUT_BLOCK_TYPE] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(messages.inputTitle)
      this.setOutput(true)
      this.setStyle(INPUT_BLOCK_STYLE)
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
