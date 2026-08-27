import * as Blockly from 'blockly'
import { beforeAll, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, ROOT_BLOCK_TYPE } from './blocks'
import { somaDosPares } from './fixtures/soma-dos-pares'
import { messagesFor } from './messages'
import {
  allowedBlockTypes,
  buildToolbox,
  emptyWorkspaceState,
  type WorkspaceState,
  withRootBlock,
} from './toolbox'

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

describe('withRootBlock', () => {
  // A saved workspace is only useful if Blockly can still load it, so every
  // result is loaded for real instead of being compared as bare JSON.
  function loadedTypes(state: WorkspaceState): string[] {
    const workspace = new Blockly.Workspace()
    try {
      Blockly.serialization.workspaces.load(state, workspace)
      return workspace.getTopBlocks(false).map((block) => block.type)
    } finally {
      workspace.dispose()
    }
  }

  it('returns a state that already has the root untouched', () => {
    expect(withRootBlock(emptyWorkspaceState)).toEqual(emptyWorkspaceState)
    expect(withRootBlock(somaDosPares)).toEqual(somaDosPares)
  })

  it('re-seeds the root into a saved state that lost it, keeping the blocks', () => {
    const orphaned: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'math_number', id: 'orfao', x: 10, y: 10, fields: { NUM: 7 } }],
      },
    }

    expect(loadedTypes(withRootBlock(orphaned))).toEqual([ROOT_BLOCK_TYPE, 'math_number'])
  })

  it('keeps the variables of a state it re-seeds', () => {
    const orphaned: WorkspaceState = {
      blocks: { languageVersion: 0, blocks: [] },
      variables: [{ name: 'soma', id: 'varSoma' }],
    }

    expect(withRootBlock(orphaned).variables).toEqual([{ name: 'soma', id: 'varSoma' }])
    expect(loadedTypes(withRootBlock(orphaned))).toEqual([ROOT_BLOCK_TYPE])
  })

  it('turns an empty or missing state into the empty workspace', () => {
    expect(loadedTypes(withRootBlock(undefined))).toEqual([ROOT_BLOCK_TYPE])
    expect(loadedTypes(withRootBlock({}))).toEqual([ROOT_BLOCK_TYPE])
  })

  it('never mutates the shared empty workspace state', () => {
    const rootOf = (state: WorkspaceState) =>
      (state as { blocks: { blocks: { x: number }[] } }).blocks.blocks[0] as { x: number }

    rootOf(withRootBlock({})).x = 999

    expect(rootOf(emptyWorkspaceState).x).toBe(40)
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
