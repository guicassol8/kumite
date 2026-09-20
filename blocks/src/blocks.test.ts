import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
import { afterEach, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { SOLUTION_FUNCTION_NAME, SOLUTION_PARAM_NAME } from './contract'
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

  it('reserves the two names the solution contract owns', () => {
    defineKumiteBlocks()

    // Blockly keeps the list as a comma-separated string of every reserved
    // word; a participant variable matching one gets renamed at `init()`.
    // `RESERVED_WORDS_` is `protected` in the .d.ts with no public reader, and
    // asserting on it here is the point: it pins the registration to
    // `defineKumiteBlocks`, where generate.test.ts can only observe the effect.
    const reserved = (
      javascriptGenerator as unknown as { RESERVED_WORDS_: string }
    ).RESERVED_WORDS_.split(',')
    expect(reserved).toContain(SOLUTION_FUNCTION_NAME)
    expect(reserved).toContain(SOLUTION_PARAM_NAME)
  })

  it('registers the reserved names once, however often it is called', () => {
    // `addReservedWords` is `RESERVED_WORDS_ += words + ','` — it appends
    // unconditionally. `defineKumiteBlocks` runs on every `generateSolution`
    // call, so without a guard the list grows by two entries per codegen for
    // the life of the process, and `init()` re-splits it every time.
    defineKumiteBlocks()
    defineKumiteBlocks('en')
    defineKumiteBlocks('es')

    const reserved = (
      javascriptGenerator as unknown as { RESERVED_WORDS_: string }
    ).RESERVED_WORDS_.split(',')
    expect(reserved.filter((word) => word === SOLUTION_FUNCTION_NAME)).toHaveLength(1)
    expect(reserved.filter((word) => word === SOLUTION_PARAM_NAME)).toHaveLength(1)
  })

  it('strips the non-deterministic RANDOM mode from lists_getIndex (#182)', () => {
    defineKumiteBlocks()

    withBlock('lists_getIndex', (block) => {
      const where = block.getField('WHERE') as Blockly.FieldDropdown

      expect(where.getOptions(false).map(([, value]) => value)).toEqual([
        'FROM_START',
        'FROM_END',
        'FIRST',
        'LAST',
      ])
    })
  })

  it('keeps every remaining MODE × WHERE combination generating and round-tripping', () => {
    defineKumiteBlocks()

    for (const mode of ['GET', 'GET_REMOVE', 'REMOVE']) {
      for (const where of ['FROM_START', 'FROM_END', 'FIRST', 'LAST']) {
        const workspace = new Blockly.Workspace()
        try {
          const block = workspace.newBlock('lists_getIndex')
          block.setFieldValue(mode, 'MODE')
          block.setFieldValue(where, 'WHERE')

          expect(block.getFieldValue('WHERE'), `${mode}/${where}`).toBe(where)
          // `updateAt_` rebuilds the AT input from WHERE: it is a value input
          // (connectable) only for the two indexed modes, a dummy otherwise,
          // and that wiring has to survive the stripping.
          expect(Boolean(block.getInput('AT')?.connection), `${mode}/${where} AT`).toBe(
            where === 'FROM_START' || where === 'FROM_END',
          )

          javascriptGenerator.init(workspace)
          const generated = javascriptGenerator.blockToCode(block, true)
          const code = typeof generated === 'string' ? generated : generated[0]
          expect(code, `${mode}/${where} code`).not.toBe('')

          const state = Blockly.serialization.workspaces.save(workspace)
          const reloaded = new Blockly.Workspace()
          try {
            Blockly.serialization.workspaces.load(state, reloaded)
            const back = reloaded.getTopBlocks(false)[0] as Blockly.Block
            expect(back.getFieldValue('MODE'), `${mode}/${where} reload`).toBe(mode)
            expect(back.getFieldValue('WHERE'), `${mode}/${where} reload`).toBe(where)
          } finally {
            reloaded.dispose()
          }
        } finally {
          workspace.dispose()
        }
      }
    }
  })

  it('strips the denied options once, however often it is called', () => {
    // `defineKumiteBlocks` runs on every `generateSolution` call and #57 calls
    // it again to relabel. Without a guard each call would wrap the previous
    // `init`, so the chain — and the work every new block does — would grow
    // without bound in the judge process.
    defineKumiteBlocks()
    const wrapped = (Blockly.Blocks.lists_getIndex as { init: unknown }).init

    defineKumiteBlocks('en')
    defineKumiteBlocks('es')

    expect((Blockly.Blocks.lists_getIndex as { init: unknown }).init).toBe(wrapped)
    withBlock('lists_getIndex', (block) => {
      const where = block.getField('WHERE') as Blockly.FieldDropdown
      expect(where.getOptions(false)).toHaveLength(4)
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
