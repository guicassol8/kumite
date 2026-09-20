import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
import { beforeAll, describe, expect, it } from 'vitest'

import { defineKumiteBlocks } from './blocks'
import { allowedBlockTypes } from './toolbox'

/**
 * The whole point of #182: a solution has to mean the same thing every time it
 * runs, or "Run" and "Submit" disagree and the judge re-judges the same
 * workspace differently on every attempt.
 *
 * This is the sweep that found the bug, kept as a standing guard: it walks
 * every block the curated toolbox offers, enumerates every dropdown
 * combination the editor lets a participant pick, generates the code and looks
 * for a source of non-determinism. A block added to the toolbox tomorrow with
 * a random or clock-reading mode fails here, loudly, instead of becoming the
 * next #182.
 */
const NON_DETERMINISTIC = /Math\.random|Date\.now|new Date|performance\.now/

/** A `FieldVariable` *is* a `FieldDropdown`, but its options are the
 * workspace's variables plus Rename/Delete — nothing a participant picks that
 * could change the shape of the generated code. */
function dropdownsOf(block: Blockly.Block): Blockly.FieldDropdown[] {
  return block.inputList
    .flatMap((input) => input.fieldRow)
    .filter(
      (field): field is Blockly.FieldDropdown =>
        field instanceof Blockly.FieldDropdown && !(field instanceof Blockly.FieldVariable),
    )
}

/** Every combination of the dropdown values the editor offers, as
 * `[fieldName, value]` pairs — `[[]]` for a block with no dropdown, so it is
 * still generated once. */
function dropdownCombinations(block: Blockly.Block): [string, string][][] {
  let combinations: [string, string][][] = [[]]

  for (const field of dropdownsOf(block)) {
    const name = field.name
    if (!name) continue
    const values = field.getOptions(false).map(([, value]) => value as string)
    combinations = combinations.flatMap((prefix) =>
      values.map((value): [string, string][] => [...prefix, [name, value]]),
    )
  }

  return combinations
}

function generatedCode(type: string, choices: [string, string][]): string {
  const workspace = new Blockly.Workspace()
  try {
    const block = workspace.newBlock(type)
    block.initModel()
    for (const [name, value] of choices) block.setFieldValue(value, name)

    javascriptGenerator.init(workspace)
    const generated = javascriptGenerator.blockToCode(block, true)
    // `finish` is not optional here: `blockToCode` alone returns the call
    // site, and Blockly emits the helper *definitions* — which is where
    // `listsGetRandomItem`'s `Math.random()` actually lives — only when the
    // generation is finished. A sweep without it would have missed #182.
    return javascriptGenerator.finish(typeof generated === 'string' ? generated : generated[0])
  } finally {
    workspace.dispose()
  }
}

beforeAll(() => {
  defineKumiteBlocks()
})

describe('the curated toolbox is deterministic (#182)', () => {
  it('never generates a random or clock-reading expression, in any dropdown combination', () => {
    let swept = 0

    for (const type of allowedBlockTypes) {
      const workspace = new Blockly.Workspace()
      const combinations = (() => {
        try {
          return dropdownCombinations(workspace.newBlock(type))
        } finally {
          workspace.dispose()
        }
      })()

      for (const choices of combinations) {
        swept++
        const label = `${type} ${JSON.stringify(Object.fromEntries(choices))}`
        expect(generatedCode(type, choices), label).not.toMatch(NON_DETERMINISTIC)
      }
    }

    // Guards the guard: a sweep that silently enumerated nothing would pass
    // above and prove nothing. There are more combinations than blocks.
    expect(swept).toBeGreaterThan(allowedBlockTypes.length)
  })

  it('would catch the RANDOM mode if it ever came back to the toolbox', () => {
    // Puts the option back on the field by hand — the only way to reach it now
    // that `defineKumiteBlocks` strips it — and proves the detector above is
    // not vacuous: this is exactly the code that made #182.
    const workspace = new Blockly.Workspace()
    try {
      const block = workspace.newBlock('lists_getIndex')
      const where = block.getField('WHERE') as Blockly.FieldDropdown
      where.setOptions([...where.getOptions(false), ['aleatório', 'RANDOM']])
      block.setFieldValue('RANDOM', 'WHERE')

      javascriptGenerator.init(workspace)
      const generated = javascriptGenerator.blockToCode(block, true)
      const source = javascriptGenerator.finish(
        typeof generated === 'string' ? generated : generated[0],
      )

      expect(source).toMatch(NON_DETERMINISTIC)
    } finally {
      workspace.dispose()
    }
  })
})
