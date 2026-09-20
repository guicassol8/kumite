import * as Blockly from 'blockly'
import { beforeAll, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { somaDosPares } from './fixtures/soma-dos-pares'
import { messagesFor } from './messages'
import {
  allowedBlockTypes,
  buildToolbox,
  CREATE_VARIABLE_BUTTON_KEY,
  deniedFieldValues,
  emptyWorkspaceState,
  VARIABLES_CATEGORY_KEY,
  variablesFlyout,
  type WorkspaceState,
  withRootBlock,
} from './toolbox'

type Category = {
  kind: string
  name: string
  custom?: string
  contents?: { kind: string; type: string }[]
}

function categoriesOf(locale?: Parameters<typeof buildToolbox>[0]): Category[] {
  const toolbox = buildToolbox(locale) as { contents: Category[] }
  return toolbox.contents
}

/** Variables is a `custom` category: its blocks come from `variablesFlyout`. */
function staticCategoriesOf(locale?: Parameters<typeof buildToolbox>[0]) {
  return categoriesOf(locale)
    .filter((category) => !category.custom)
    .map((category) => ({ ...category, contents: category.contents ?? [] }))
}

function workspaceWithVariables(...names: string[]): Blockly.Workspace {
  const workspace = new Blockly.Workspace()
  for (const name of names) workspace.getVariableMap().createVariable(name)
  return workspace
}

function flyoutOf(workspace: Blockly.Workspace, locale?: Parameters<typeof buildToolbox>[0]) {
  return variablesFlyout(workspace, locale) as {
    kind: string
    type?: string
    text?: string
    callbackkey?: string
    fields?: { VAR: { name: string; type: string } }
  }[]
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
    for (const category of staticCategoriesOf()) {
      expect(category.contents.length, category.name).toBeGreaterThan(0)
    }
  })

  it('only offers blocks Blockly actually knows', () => {
    for (const category of staticCategoriesOf()) {
      for (const block of category.contents) {
        expect(Blockly.Blocks[block.type], block.type).toBeDefined()
      }
    }
  })

  it('makes Variables — and only Variables — a dynamic category', () => {
    const dynamic = categoriesOf().filter((category) => category.custom)

    expect(dynamic.map((category) => category.name)).toEqual([messagesFor().categoryVariables])
    expect(dynamic[0]?.custom).toBe(VARIABLES_CATEGORY_KEY)
    // A dynamic category is filled by the callback, never by static contents.
    expect(dynamic[0]?.contents).toBeUndefined()
  })
})

describe('variablesFlyout', () => {
  it('offers the create button and the input block when there is no variable', () => {
    const workspace = workspaceWithVariables()
    try {
      const flyout = flyoutOf(workspace)

      expect(flyout[0]).toEqual({
        kind: 'button',
        text: messagesFor().categoryVariablesNew,
        callbackkey: CREATE_VARIABLE_BUTTON_KEY,
      })
      expect(flyout.slice(1).map((item) => item.type)).toEqual([INPUT_BLOCK_TYPE])
    } finally {
      workspace.dispose()
    }
  })

  it('names the create button in the requested locale', () => {
    const workspace = workspaceWithVariables()
    try {
      expect(flyoutOf(workspace, 'en')[0]?.text).toBe(messagesFor('en').categoryVariablesNew)
    } finally {
      workspace.dispose()
    }
  })

  it('adds a setter and one getter per existing variable', () => {
    const workspace = workspaceWithVariables('soma', 'numero')
    try {
      const flyout = flyoutOf(workspace)

      expect(flyout.map((item) => item.type)).toEqual([
        undefined, // the button
        INPUT_BLOCK_TYPE,
        'variables_set',
        'variables_get',
        'variables_get',
      ])
      // The setter targets the newest variable, the getters are sorted by name.
      expect(flyout[2]?.fields?.VAR.name).toBe('numero')
      expect(flyout.slice(3).map((item) => item.fields?.VAR.name)).toEqual(['numero', 'soma'])
    } finally {
      workspace.dispose()
    }
  })

  it('never offers a block outside the allowlist — this is what keeps math_change out', () => {
    const workspace = workspaceWithVariables('soma')
    try {
      const offered = flyoutOf(workspace)
        .map((item) => item.type)
        .filter((type): type is string => Boolean(type))

      expect(offered).not.toContain('math_change')
      for (const type of offered) {
        expect(allowedBlockTypes, type).toContain(type)
      }
    } finally {
      workspace.dispose()
    }
  })

  it('emits variable fields Blockly can load back', () => {
    const workspace = workspaceWithVariables('soma')
    try {
      const setter = flyoutOf(workspace).find((item) => item.type === 'variables_set')
      const target = new Blockly.Workspace()
      try {
        Blockly.serialization.workspaces.load(
          { blocks: { languageVersion: 0, blocks: [{ ...setter, kind: undefined }] } },
          target,
        )

        expect(target.getTopBlocks(false).map((block) => block.type)).toEqual(['variables_set'])
        expect(target.getVariableMap().getAllVariables()[0]?.getName()).toBe('soma')
      } finally {
        target.dispose()
      }
    } finally {
      workspace.dispose()
    }
  })
})

describe('allowedBlockTypes', () => {
  it('is exactly the toolbox — static categories and variables flyout — plus the root', () => {
    const workspace = workspaceWithVariables('soma')
    try {
      const offered = [
        ROOT_BLOCK_TYPE,
        ...staticCategoriesOf().flatMap((category) => category.contents.map((block) => block.type)),
        ...flyoutOf(workspace)
          .map((item) => item.type)
          .filter((type): type is string => Boolean(type)),
      ]

      expect([...allowedBlockTypes].sort()).toEqual([...new Set(offered)].sort())
    } finally {
      workspace.dispose()
    }
  })

  it('includes the root block, which is never in the toolbox', () => {
    expect(allowedBlockTypes).toContain(ROOT_BLOCK_TYPE)
    expect(staticCategoriesOf().flatMap((c) => c.contents.map((b) => b.type))).not.toContain(
      ROOT_BLOCK_TYPE,
    )
  })

  it('has no duplicates', () => {
    expect(new Set(allowedBlockTypes).size).toBe(allowedBlockTypes.length)
  })
})

describe('deniedFieldValues', () => {
  it('never names a block the toolbox does not offer', () => {
    // The table is a subtraction from the curated toolbox: citing a type that
    // is not in `allowedBlockTypes` would be a rule nothing could ever apply.
    for (const type of Object.keys(deniedFieldValues)) {
      expect(allowedBlockTypes, type).toContain(type)
    }
  })

  it('denies the RANDOM mode of lists_getIndex — the one non-deterministic option (#182)', () => {
    expect(deniedFieldValues.lists_getIndex?.WHERE).toContain('RANDOM')
  })

  it('never carries an entry that denies nothing', () => {
    for (const [type, fields] of Object.entries(deniedFieldValues)) {
      expect(Object.keys(fields).length, type).toBeGreaterThan(0)
      for (const [field, values] of Object.entries(fields)) {
        expect(values.length, `${type}.${field}`).toBeGreaterThan(0)
      }
    }
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
