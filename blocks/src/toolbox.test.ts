import * as Blockly from 'blockly'
import { beforeAll, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, ROOT_BLOCK_TYPE } from './blocks'
import { messagesFor } from './messages'
import { allowedBlockTypes, buildToolbox, emptyWorkspaceState } from './toolbox'

type Category = { kind: string; name: string; contents: { kind: string; type: string }[] }

function categoriesOf(locale?: Parameters<typeof buildToolbox>[0]): Category[] {
  const toolbox = buildToolbox(locale) as { contents: Category[] }
  return toolbox.contents
}

beforeAll(() => {
  defineKumiteBlocks()
})

describe('buildToolbox', () => {
  it('exposes the six curated categories', () => {
    expect(categoriesOf().map((category) => category.name)).toEqual([
      'Lógica',
      'Laços',
      'Matemática',
      'Texto',
      'Listas',
      'Variáveis',
    ])
  })

  it('names every category in the requested locale', () => {
    const messages = messagesFor('en')

    expect(categoriesOf('en').map((category) => category.name)).toEqual([
      messages.categoryLogic,
      messages.categoryLoops,
      messages.categoryMath,
      messages.categoryText,
      messages.categoryLists,
      messages.categoryVariables,
    ])
  })

  it('never ships an empty category', () => {
    for (const category of categoriesOf()) {
      expect(category.contents.length, category.name).toBeGreaterThan(0)
    }
  })

  it('only offers blocks Blockly actually knows', () => {
    for (const category of categoriesOf()) {
      for (const block of category.contents) {
        expect(Blockly.Blocks[block.type], block.type).toBeDefined()
      }
    }
  })
})

describe('allowedBlockTypes', () => {
  it('is exactly the toolbox plus the root block', () => {
    const fromToolbox = categoriesOf().flatMap((category) =>
      category.contents.map((block) => block.type),
    )

    expect([...allowedBlockTypes].sort()).toEqual([ROOT_BLOCK_TYPE, ...fromToolbox].sort())
  })

  it('includes the root block, which is never in the toolbox', () => {
    expect(allowedBlockTypes).toContain(ROOT_BLOCK_TYPE)
    expect(categoriesOf().flatMap((c) => c.contents.map((b) => b.type))).not.toContain(
      ROOT_BLOCK_TYPE,
    )
  })

  it('has no duplicates', () => {
    expect(new Set(allowedBlockTypes).size).toBe(allowedBlockTypes.length)
  })
})

describe('emptyWorkspaceState', () => {
  it('loads into a headless workspace as a single root block', () => {
    const workspace = new Blockly.Workspace()
    try {
      Blockly.serialization.workspaces.load(emptyWorkspaceState, workspace)
      const blocks = workspace.getAllBlocks(false)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]?.type).toBe(ROOT_BLOCK_TYPE)
    } finally {
      workspace.dispose()
    }
  })
})
