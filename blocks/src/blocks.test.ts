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

  it('re-registers with another locale without throwing (#57 relabels at runtime)', () => {
    defineKumiteBlocks('pt')

    expect(() => defineKumiteBlocks('es')).not.toThrow()
    withBlock(ROOT_BLOCK_TYPE, (block) => {
      expect(labelsOf(block)).toContain(messagesFor('es').solveReturn)
      expect(labelsOf(block)).not.toContain(messagesFor('pt').solveReturn)
    })
  })
})
