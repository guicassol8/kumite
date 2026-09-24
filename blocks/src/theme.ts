// Always the main `blockly` entrypoint, never `blockly/core` — see blocks/AGENTS.md.
import * as Blockly from 'blockly'

/**
 * Mirror of the design tokens the editor theme reads, keyed by the token name.
 *
 * Blockly only accepts a parseable colour — it derives `colourSecondary` and
 * `colourTertiary` from the primary — so `var(--block-logic)` cannot reach it.
 * Every colour below is therefore read from this table by token name, never
 * written as a loose hex. `docs/design/tokens/tokens.css` is the only source of
 * truth: `front/src/test/design-parity.test.ts` fails the moment a value here
 * diverges from it, and the token wins.
 */
export const KUMITE_TOKENS = {
  /** `:root` `--block-*` — the same in light and dark (identity § 6). */
  block: {
    '--block-logic': '#2A75BA',
    '--block-loops': '#298646',
    '--block-math': '#6B64BA',
    '--block-text': '#008282',
    '--block-lists': '#8E57A5',
    '--block-variables': '#A76700',
    '--block-root': '#2A2523',
    '--block-input': '#DD2824',
  },
  /** `:root` chrome tokens. */
  light: {
    '--background-2': '#F2F0EC',
    '--card': '#FFFFFF',
    '--foreground': '#1C1716',
    '--muted-foreground': '#69615D',
    '--border': '#E1DDDA',
  },
  /** `.dark` chrome tokens, `var()` resolved. */
  dark: {
    '--background-2': '#1B1716',
    '--card': '#1B1716',
    '--foreground': '#F3F1EF',
    '--muted-foreground': '#9D9792',
    '--border': '#312D2C',
  },
} as const

export type KumiteBlockToken = keyof typeof KUMITE_TOKENS.block
type ChromeTokens = (typeof KUMITE_TOKENS)['light' | 'dark']

/** Style `kumite_solve` declares through `setStyle` — also a CSS class on its SVG group. */
export const ROOT_BLOCK_STYLE = 'kumite_root_blocks'
/** Style `kumite_input` declares through `setStyle`. */
export const INPUT_BLOCK_STYLE = 'kumite_input_blocks'

/** Width of the coloured bar on each toolbox category row (Blockly's default is 8). */
export const KUMITE_CATEGORY_BAR_PX = 4

/**
 * Grid of the editor canvas. Its colour is an `inject` option, not a theme
 * one, so `setTheme` never touches it: the front re-colours the dots per mode
 * with a CSS rule on the grid pattern (`stroke: var(--border)`).
 */
export const kumiteGridOptions = {
  spacing: 20,
  length: 1,
  colour: KUMITE_TOKENS.light['--border'],
  snap: true,
} as const

function blockStyle(token: KumiteBlockToken): Partial<Blockly.Theme.BlockStyle> {
  // Only the primary: Blockly derives secondary/tertiary from it, which is
  // what keeps a block's shadow and outline in the same hue.
  return { colourPrimary: KUMITE_TOKENS.block[token], hat: '' }
}

function categoryStyle(token: KumiteBlockToken): Blockly.Theme.CategoryStyle {
  return { colour: KUMITE_TOKENS.block[token] }
}

/**
 * Shared by both themes: the block colours do not change with the mode
 * (identity § 6). `variable_dynamic_blocks` is not in the curated toolbox but
 * is covered anyway, so a dynamic variable block never falls back to Classic.
 */
const blockStyles: Record<string, Partial<Blockly.Theme.BlockStyle>> = {
  logic_blocks: blockStyle('--block-logic'),
  loop_blocks: blockStyle('--block-loops'),
  math_blocks: blockStyle('--block-math'),
  text_blocks: blockStyle('--block-text'),
  list_blocks: blockStyle('--block-lists'),
  variable_blocks: blockStyle('--block-variables'),
  variable_dynamic_blocks: blockStyle('--block-variables'),
  [ROOT_BLOCK_STYLE]: blockStyle('--block-root'),
  [INPUT_BLOCK_STYLE]: blockStyle('--block-input'),
}

/** The `categorystyle` names `buildToolbox()` emits. */
const categoryStyles: Record<string, Blockly.Theme.CategoryStyle> = {
  logic_category: categoryStyle('--block-logic'),
  loop_category: categoryStyle('--block-loops'),
  math_category: categoryStyle('--block-math'),
  text_category: categoryStyle('--block-text'),
  list_category: categoryStyle('--block-lists'),
  variable_category: categoryStyle('--block-variables'),
}

/**
 * Barlow 13/500 from the identity. Blockly reads `size` in **points**
 * (`${size}pt` in the renderer's ConstantProvider) while the identity writes
 * every size in px, so 13 px = 9.75 pt.
 */
const fontStyle: Blockly.Theme.FontStyle = {
  family: "'Barlow', 'Inter', system-ui, sans-serif",
  weight: '500',
  size: 9.75,
}

function componentStyles(
  tokens: ChromeTokens,
  canvas: keyof ChromeTokens,
): Blockly.Theme.ComponentStyle {
  return {
    workspaceBackgroundColour: tokens[canvas],
    toolboxBackgroundColour: tokens['--card'],
    toolboxForegroundColour: tokens['--foreground'],
    flyoutBackgroundColour: tokens['--card'],
    flyoutForegroundColour: tokens['--foreground'],
    flyoutOpacity: 1,
    scrollbarColour: tokens['--muted-foreground'],
    scrollbarOpacity: 0.4,
    insertionMarkerColour: tokens['--foreground'],
    insertionMarkerOpacity: 0.2,
    // Never the red: the input block is "the only red on the canvas".
    markerColour: tokens['--foreground'],
    cursorColour: tokens['--foreground'],
    selectedGlowColour: tokens['--foreground'],
  }
}

function defineKumiteTheme(
  name: string,
  tokens: ChromeTokens,
  canvas: keyof ChromeTokens,
): Blockly.Theme {
  return Blockly.Theme.defineTheme(name, {
    name,
    // Without a base, a native style nobody listed resolves to black.
    base: Blockly.Themes.Classic,
    blockStyles,
    categoryStyles,
    componentStyles: componentStyles(tokens, canvas),
    fontStyle,
    startHats: false,
  })
}

/** Light: canvas on paper 2, toolbox and flyout on the card. */
export const kumiteTheme = defineKumiteTheme('kumite', KUMITE_TOKENS.light, '--background-2')

/** Dark: canvas, toolbox and flyout all on the dark card. */
export const kumiteThemeDark = defineKumiteTheme('kumite-dark', KUMITE_TOKENS.dark, '--card')
