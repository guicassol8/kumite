import { ROOT_BLOCK_TYPE, type WorkspaceState } from '@kumite/blocks'

type SerializedBlock = { type?: string; inputs?: Record<string, unknown> }
type SerializedBlocks = { blocks?: SerializedBlock[] }

/**
 * Whether the solver has plugged anything into the root block yet.
 *
 * Blockly omits empty sockets when it serializes, so "no `inputs` on
 * `kumite_solve`" is exactly "nothing connected to it" — neither a body nor a
 * return value. Blocks dropped loose on the canvas do not count, which is the
 * same thing codegen does with `thisOnly` and precisely what the warning tells
 * the solver.
 *
 * A root with a body but no return is NOT empty: that solution runs and its
 * cases fail with `obtido: null`, and seeing that is how the missing "retornar"
 * gets learned. A state with no root at all is not empty either — codegen
 * raises its own `missing-root`, which says far more than a generic warning.
 */
export function isEmptySolution(state: WorkspaceState): boolean {
  const blocks = (state.blocks as SerializedBlocks | undefined)?.blocks ?? []
  const root = blocks.find((block) => block.type === ROOT_BLOCK_TYPE)
  if (!root) return blocks.length === 0

  return Object.keys(root.inputs ?? {}).length === 0
}
