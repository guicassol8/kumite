import type * as Blockly from 'blockly'

import { INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { type BlockLocale, type BlockMessages, DEFAULT_LOCALE, messagesFor } from './messages'

export type WorkspaceState = Record<string, unknown>

type CuratedCategory = {
  label: keyof BlockMessages
  style: string
  blocks: readonly string[]
  /** Set on the one category Blockly fills through a callback, not statically. */
  custom?: string
}

/** Key the editor registers `variablesFlyout` under (T4, `front/`). */
export const VARIABLES_CATEGORY_KEY = 'KUMITE_VARIABLES'

/** Key the editor registers the "create variable" button handler under. */
export const CREATE_VARIABLE_BUTTON_KEY = 'KUMITE_CREATE_VARIABLE'

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
    // Static contents would leave the solver with the single variable Blockly
    // seeds, because "create variable" only exists in a flyout callback.
    // Blockly's own `VARIABLE` callback is not an option: it injects
    // `math_change`, which is outside `allowedBlockTypes` and the judge would
    // refuse the solution. Hence our own flyout, below.
    custom: VARIABLES_CATEGORY_KEY,
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
      ...(category.custom
        ? { custom: category.custom }
        : { contents: category.blocks.map((type) => ({ kind: 'block', type })) }),
    })),
  }
}

function variableField(variable: Blockly.IVariableModel<Blockly.IVariableState>) {
  return { VAR: { name: variable.getName(), type: variable.getType() } }
}

/**
 * Contents of the Variables flyout, rebuilt on every open so the variables the
 * solver just created are there.
 *
 * Mirrors Blockly's own variable flyout minus `math_change`: the create button,
 * our `kumite_input`, a setter for the newest variable and a getter per
 * variable. Every type it emits is in `allowedBlockTypes` by construction — the
 * curated Variables category is still the single list the judge agrees with.
 *
 * Takes a plain `Workspace` (only the variable map is read) so it stays
 * testable headless, like everything else in this package.
 */
export function variablesFlyout(
  workspace: Blockly.Workspace,
  locale: BlockLocale = DEFAULT_LOCALE,
): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const messages = messagesFor(locale)
  const variables = workspace.getVariableMap().getVariablesOfType('')
  const newest = variables[variables.length - 1]
  const byName = [...variables].sort((a, b) =>
    a.getName().toLowerCase().localeCompare(b.getName().toLowerCase()),
  )

  return [
    {
      kind: 'button',
      text: messages.categoryVariablesNew,
      callbackkey: CREATE_VARIABLE_BUTTON_KEY,
    },
    { kind: 'block', type: INPUT_BLOCK_TYPE },
    ...(newest ? [{ kind: 'block', type: 'variables_set', fields: variableField(newest) }] : []),
    ...byName.map((variable) => ({
      kind: 'block',
      type: 'variables_get',
      fields: variableField(variable),
    })),
  ]
}

/**
 * Every block a solution may contain. Derived from the toolbox plus the root —
 * never a second hand-written list, which would drift.
 */
export const allowedBlockTypes: readonly string[] = [
  ROOT_BLOCK_TYPE,
  ...CURATED_CATEGORIES.flatMap((category) => category.blocks),
]

/**
 * Dropdown values the curated toolbox subtracts from blocks it otherwise
 * offers, by block type and field name.
 *
 * `allowedBlockTypes` is granular per type and cannot express "this block, but
 * not that one mode", so this is its companion: a declarative table, read by
 * the editor (`defineKumiteBlocks` removes the options) and by the judge
 * (`generateSolution` refuses a serialized state that still carries one).
 *
 * `lists_getIndex` with `WHERE=RANDOM` emits `listsGetRandomItem`, i.e.
 * `Math.floor(Math.random() * ...)`: the same workspace passed "Run" and
 * failed "Submit", and re-judged differently on every attempt (#182). It is
 * the only non-deterministic option in the whole curated toolbox —
 * `determinism.test.ts` is what keeps that true for the next block added here.
 */
export const deniedFieldValues: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  lists_getIndex: { WHERE: ['RANDOM'] },
}

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
