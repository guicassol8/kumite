import type * as Blockly from 'blockly'

import { INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { type BlockLocale, type BlockMessages, DEFAULT_LOCALE, messagesFor } from './messages'

export type WorkspaceState = Record<string, unknown>

type CuratedCategory = {
  label: keyof BlockMessages
  style: string
  blocks: readonly string[]
}

/**
 * The curated subset — hand-picked, not "everything Blockly ships". Adding a
 * block here is what makes it legal in a solution: `allowedBlockTypes` is
 * derived from this table, so the editor and the judge can never disagree.
 */
const CURATED_CATEGORIES: readonly CuratedCategory[] = [
  {
    label: 'categoryLogic',
    style: 'logic_category',
    blocks: ['controls_if', 'logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean'],
  },
  {
    label: 'categoryLoops',
    style: 'loop_category',
    blocks: ['controls_repeat_ext', 'controls_forEach', 'controls_whileUntil'],
  },
  {
    label: 'categoryMath',
    style: 'math_category',
    blocks: ['math_number', 'math_arithmetic', 'math_modulo', 'math_round'],
  },
  {
    label: 'categoryText',
    style: 'text_category',
    blocks: ['text', 'text_join', 'text_length'],
  },
  {
    label: 'categoryLists',
    style: 'list_category',
    blocks: ['lists_create_empty', 'lists_create_with', 'lists_getIndex', 'lists_length'],
  },
  {
    label: 'categoryVariables',
    style: 'variable_category',
    blocks: [INPUT_BLOCK_TYPE, 'variables_set', 'variables_get'],
  },
]

export function buildToolbox(
  locale: BlockLocale = DEFAULT_LOCALE,
): Blockly.utils.toolbox.ToolboxDefinition {
  const messages = messagesFor(locale)
  return {
    kind: 'categoryToolbox',
    contents: CURATED_CATEGORIES.map((category) => ({
      kind: 'category',
      name: messages[category.label],
      categorystyle: category.style,
      contents: category.blocks.map((type) => ({ kind: 'block', type })),
    })),
  }
}

/**
 * Every block a solution may contain. Derived from the toolbox plus the root —
 * never a second hand-written list, which would drift.
 */
export const allowedBlockTypes: readonly string[] = [
  ROOT_BLOCK_TYPE,
  ...CURATED_CATEGORIES.flatMap((category) => category.blocks),
]

type SerializedBlock = { type?: string; [key: string]: unknown }
type SerializedBlocks = { languageVersion?: number; blocks?: SerializedBlock[] }

function rootBlockState(): SerializedBlock {
  return { type: ROOT_BLOCK_TYPE, id: 'kumiteSolveRoot', x: 40, y: 40 }
}

/** The workspace a solver starts from: the root block and nothing else. */
export const emptyWorkspaceState: WorkspaceState = {
  blocks: { languageVersion: 0, blocks: [rootBlockState()] },
}

/**
 * Guarantees the root block is in a workspace state before it is loaded.
 *
 * The editor forbids deleting the root, but a state saved before that (or one
 * hand-edited in localStorage) may not have it — and without the root there is
 * no way back in, since the toolbox never offers it. Re-seeding preserves
 * whatever else was saved, blocks and variables alike, instead of resetting.
 */
export function withRootBlock(state?: WorkspaceState): WorkspaceState {
  const saved = (state?.blocks as SerializedBlocks | undefined)?.blocks ?? []
  if (saved.some((block) => block.type === ROOT_BLOCK_TYPE)) return state as WorkspaceState

  return {
    ...state,
    blocks: { languageVersion: 0, blocks: [rootBlockState(), ...saved] },
  }
}
