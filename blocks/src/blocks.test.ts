import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
import { afterEach, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { messagesFor } from './messages'

function labelsOf(block: Blockly.Block): string[] {
  return block.inputList.flatMap((input) => input.fieldRow).map((field) => field.getText())
}

// A headless workspace is enough: none of this needs a DOM, which is exactly
// what the back will do in #20.
function withBlock<T>(type: string, run: (block: Blockly.Block) => T): T {
  const workspace = new Blockly.Workspace()
  try {
    return run(workspace.newBlock(type))
  } finally {
    workspace.dispose()
  }
}

// The registry is Blockly's, not ours: the assertions run its own
// `preconditionFn` so a change of heart upstream fails here instead of only in
// the browser. Headless blocks are enough — the precondition only reads
// `isInFlyout` and `isDeletable()`.
function precondition(
  item: ReturnType<typeof Blockly.ContextMenuRegistry.registry.getItem>,
  block: Blockly.Block,
): string | undefined {
  const scope = { block } as unknown as Blockly.ContextMenuRegistry.Scope
  return item?.preconditionFn?.(scope, new Event('contextmenu'))
}

afterEach(() => {
  defineKumiteBlocks()
})

describe('defineKumiteBlocks', () => {
  it('registers both kumite blocks', () => {
    defineKumiteBlocks()

    expect(Blockly.Blocks[ROOT_BLOCK_TYPE]).toBeDefined()
    expect(Blockly.Blocks[INPUT_BLOCK_TYPE]).toBeDefined()
  })

  it('registers a JS generator for both kumite blocks', () => {
    defineKumiteBlocks()

    expect(typeof javascriptGenerator.forBlock[ROOT_BLOCK_TYPE]).toBe('function')
    expect(typeof javascriptGenerator.forBlock[INPUT_BLOCK_TYPE]).toBe('function')
  })

  it('builds the root block with a body and a return input', () => {
    defineKumiteBlocks()

    withBlock(ROOT_BLOCK_TYPE, (block) => {
      expect(block.getInput('BODY')).not.toBeNull()
      expect(block.getInput('RETURN')).not.toBeNull()
    })
  })

  it('leaves the root block unable to connect above or below', () => {
    defineKumiteBlocks()

    withBlock(ROOT_BLOCK_TYPE, (block) => {
      expect(block.previousConnection).toBeNull()
      expect(block.nextConnection).toBeNull()
    })
  })

  it('gives kumite_input an output and no statement connections', () => {
    defineKumiteBlocks()

    withBlock(INPUT_BLOCK_TYPE, (block) => {
      expect(block.outputConnection).not.toBeNull()
      expect(block.previousConnection).toBeNull()
    })
  })

  it('labels the blocks in the requested locale', () => {
    defineKumiteBlocks('en')

    withBlock(ROOT_BLOCK_TYPE, (block) => {
      expect(labelsOf(block)).toContain(messagesFor('en').solveTitle)
      expect(labelsOf(block)).toContain(messagesFor('en').solveReturn)
    })
    withBlock(INPUT_BLOCK_TYPE, (block) => {
      expect(labelsOf(block)).toContain(messagesFor('en').inputTitle)
    })
  })

  it('marks the root block as undeletable and leaves the curated blocks alone', () => {
    defineKumiteBlocks()

    withBlock(ROOT_BLOCK_TYPE, (block) => {
      expect(block.isOwnDeletable()).toBe(false)
      expect(block.isDeletable()).toBe(false)
    })
    withBlock('math_number', (block) => {
      expect(block.isOwnDeletable()).toBe(true)
    })
  })

  it('hides "delete" and "duplicate" from the root block context menu', () => {
    defineKumiteBlocks()

    for (const id of ['blockDelete', 'blockDuplicate']) {
      const item = Blockly.ContextMenuRegistry.registry.getItem(id)
      expect(item?.preconditionFn, id).toBeTypeOf('function')

      withBlock(ROOT_BLOCK_TYPE, (block) => {
        expect(precondition(item, block), `${id} on the root`).toBe('hidden')
      })
      withBlock('math_number', (block) => {
        expect(precondition(item, block), `${id} on a curated block`).toBe('enabled')
      })
    }
  })

  it('re-registers with another locale without throwing (#57 relabels at runtime)', () => {
    defineKumiteBlocks('pt')

    expect(() => defineKumiteBlocks('es')).not.toThrow()
    withBlock(ROOT_BLOCK_TYPE, (block) => {
      expect(labelsOf(block)).toContain(messagesFor('es').solveReturn)
      expect(labelsOf(block)).not.toContain(messagesFor('pt').solveReturn)
    })
  })
})
