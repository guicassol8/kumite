import * as Blockly from 'blockly'
import { describe, expect, it } from 'vitest'

import { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import {
  INPUT_BLOCK_STYLE,
  KUMITE_CATEGORY_BAR_PX,
  KUMITE_TOKENS,
  kumiteGridOptions,
  kumiteTheme,
  kumiteThemeDark,
  ROOT_BLOCK_STYLE,
} from './theme'
import { allowedBlockTypes, buildToolbox } from './toolbox'

const THEMES = [kumiteTheme, kumiteThemeDark]

function toolboxCategoryStyles(): string[] {
  const toolbox = buildToolbox() as { contents: { categorystyle?: string }[] }
  return toolbox.contents.map((category) => category.categorystyle ?? '')
}

function styleNameOf(type: string): string {
  const workspace = new Blockly.Workspace()
  try {
    return workspace.newBlock(type).getStyleName()
  } finally {
    workspace.dispose()
  }
}

describe('kumite editor theme', () => {
  it('names the two themes', () => {
    expect(kumiteTheme.name).toBe('kumite')
    expect(kumiteThemeDark.name).toBe('kumite-dark')
  })

  it('defines every categorystyle the toolbox emits, in both themes', () => {
    for (const style of toolboxCategoryStyles()) {
      for (const theme of THEMES) {
        expect(theme.categoryStyles[style], `${theme.name} → ${style}`).toBeDefined()
      }
    }
  })

  it('styles every block the toolbox allows, in both themes', () => {
    defineKumiteBlocks()
    // A new block in the toolbox without a theme style lands here, not in a
    // screenshot: `setColour` gives an `auto_#…` name no theme defines.
    for (const type of allowedBlockTypes) {
      const style = styleNameOf(type)
      for (const theme of THEMES) {
        expect(theme.blockStyles[style], `${theme.name} → ${type} (${style})`).toBeDefined()
      }
    }
  })

  it('paints each category bar the colour of its blocks', () => {
    const pairs: Record<string, string> = {
      logic_category: 'logic_blocks',
      loop_category: 'loop_blocks',
      math_category: 'math_blocks',
      text_category: 'text_blocks',
      list_category: 'list_blocks',
      variable_category: 'variable_blocks',
    }
    for (const theme of THEMES) {
      for (const [category, blocks] of Object.entries(pairs)) {
        expect(theme.categoryStyles[category]?.colour, `${theme.name} → ${category}`).toBe(
          theme.blockStyles[blocks]?.colourPrimary,
        )
      }
    }
  })

  it('reads each category colour from its --block-* token', () => {
    const expected: Record<string, keyof typeof KUMITE_TOKENS.block> = {
      logic_category: '--block-logic',
      loop_category: '--block-loops',
      math_category: '--block-math',
      text_category: '--block-text',
      list_category: '--block-lists',
      variable_category: '--block-variables',
    }
    for (const [category, token] of Object.entries(expected)) {
      expect(kumiteTheme.categoryStyles[category]?.colour, category).toBe(
        KUMITE_TOKENS.block[token],
      )
    }
  })

  it('paints the solve block in --block-root and the input block in --block-input', () => {
    defineKumiteBlocks()

    expect(styleNameOf(ROOT_BLOCK_TYPE)).toBe(ROOT_BLOCK_STYLE)
    expect(styleNameOf(INPUT_BLOCK_TYPE)).toBe(INPUT_BLOCK_STYLE)
    for (const theme of THEMES) {
      expect(theme.blockStyles[ROOT_BLOCK_STYLE]?.colourPrimary).toBe(
        KUMITE_TOKENS.block['--block-root'],
      )
      expect(theme.blockStyles[INPUT_BLOCK_STYLE]?.colourPrimary).toBe(
        KUMITE_TOKENS.block['--block-input'],
      )
    }
  })

  it('keeps the block colours identical between light and dark', () => {
    expect(kumiteThemeDark.blockStyles).toEqual(kumiteTheme.blockStyles)
    expect(kumiteThemeDark.categoryStyles).toEqual(kumiteTheme.categoryStyles)
  })

  it('puts the chrome on the light and dark tokens', () => {
    expect(kumiteTheme.componentStyles).toMatchObject({
      workspaceBackgroundColour: KUMITE_TOKENS.light['--background-2'],
      toolboxBackgroundColour: KUMITE_TOKENS.light['--card'],
      toolboxForegroundColour: KUMITE_TOKENS.light['--foreground'],
      flyoutBackgroundColour: KUMITE_TOKENS.light['--card'],
      scrollbarColour: KUMITE_TOKENS.light['--muted-foreground'],
      cursorColour: KUMITE_TOKENS.light['--foreground'],
    })
    expect(kumiteThemeDark.componentStyles).toMatchObject({
      workspaceBackgroundColour: KUMITE_TOKENS.dark['--card'],
      toolboxBackgroundColour: KUMITE_TOKENS.dark['--card'],
      toolboxForegroundColour: KUMITE_TOKENS.dark['--foreground'],
      flyoutBackgroundColour: KUMITE_TOKENS.dark['--card'],
      scrollbarColour: KUMITE_TOKENS.dark['--muted-foreground'],
      cursorColour: KUMITE_TOKENS.dark['--foreground'],
    })
  })

  it('never uses the input red for the cursor, marker or selection', () => {
    const red = KUMITE_TOKENS.block['--block-input']
    for (const theme of THEMES) {
      const { cursorColour, markerColour, selectedGlowColour } = theme.componentStyles
      expect([cursorColour, markerColour, selectedGlowColour]).not.toContain(red)
    }
  })

  it('sets Barlow 13px/500 as 9.75pt, the unit Blockly reads', () => {
    for (const theme of THEMES) {
      expect(theme.fontStyle).toEqual({
        family: "'Barlow', 'Inter', system-ui, sans-serif",
        weight: '500',
        size: 9.75,
      })
    }
  })

  it('exports the full grid options, snap included, and a 4px category bar', () => {
    expect(kumiteGridOptions).toEqual({
      spacing: 20,
      length: 1,
      colour: KUMITE_TOKENS.light['--border'],
      snap: true,
    })
    expect(KUMITE_CATEGORY_BAR_PX).toBe(4)
  })

  it('does not register the themes globally, so re-evaluating the module is safe', () => {
    // HMR and the back both re-import this module; a registry clash would throw.
    expect(() => Blockly.Theme.defineTheme('kumite', { name: 'kumite' })).not.toThrow()
  })
})
