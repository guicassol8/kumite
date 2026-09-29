import type { WorkspaceState } from '@kumite/blocks'

/**
 * One step of a practice demo (#212): the blocks of the reference solution
 * that enter on it, and the i18n key of the sentence that explains them.
 */
export type DemoStep = {
  readonly reveal: readonly string[]
  readonly textKey: string
}

/**
 * A step-by-step replay of a reference solution. The solution is the
 * `@kumite/blocks` fixture itself — never a second copy — and every step is
 * derived from it by pruning, so the last one *is* the solution.
 */
export type DemoScript = {
  readonly solution: WorkspaceState
  readonly steps: readonly DemoStep[]
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A block's children live in `inputs.<NAME>.block` and in `next.block`. */
function connectionsOf(block: Json): Json[] {
  const inputs = isObject(block['inputs']) ? Object.values(block['inputs']) : []
  return [...inputs, block['next']].filter(isObject)
}

function topBlocksOf(state: WorkspaceState): Json[] {
  const blocks = state['blocks']
  if (!isObject(blocks) || !Array.isArray(blocks['blocks'])) return []
  return blocks['blocks'].filter(isObject)
}

function idsOf(block: Json): string[] {
  const own = typeof block['id'] === 'string' ? [block['id']] : []
  const children = connectionsOf(block)
    .map((connection) => connection['block'])
    .filter(isObject)
  return [...own, ...children.flatMap(idsOf)]
}

/** Every block id in a serialized workspace, however deep, in document order. */
export function blockIdsIn(state: WorkspaceState): string[] {
  return topBlocksOf(state).flatMap(idsOf)
}

/** A connection keeps whatever it holds besides `block` (a shadow, say). */
function pruneConnection(connection: Json, revealed: ReadonlySet<string>): Json | undefined {
  const { block, ...rest } = connection
  const child = isObject(block) ? pruneBlock(block, revealed) : undefined
  const pruned = child ? { ...rest, block: child } : rest
  return Object.keys(pruned).length > 0 ? pruned : undefined
}

function pruneBlock(block: Json, revealed: ReadonlySet<string>): Json | undefined {
  if (typeof block['id'] !== 'string' || !revealed.has(block['id'])) return undefined
  const { inputs, next, ...rest } = block
  const pruned: Json = { ...rest }

  if (isObject(inputs)) {
    const kept: Json = {}
    for (const [name, connection] of Object.entries(inputs)) {
      const prunedConnection = isObject(connection)
        ? pruneConnection(connection, revealed)
        : undefined
      if (prunedConnection) kept[name] = prunedConnection
    }
    if (Object.keys(kept).length > 0) pruned['inputs'] = kept
  }
  if (isObject(next)) {
    const prunedNext = pruneConnection(next, revealed)
    if (prunedNext) pruned['next'] = prunedNext
  }
  return pruned
}

function checkIndex(script: DemoScript, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= script.steps.length) {
    throw new RangeError(`demo step ${index} is outside 0..${script.steps.length - 1}`)
  }
}

/** The ids that enter the canvas on step `index` — what the demo highlights. */
export function revealedAt(script: DemoScript, index: number): string[] {
  checkIndex(script, index)
  return [...(script.steps[index]?.reveal ?? [])]
}

/**
 * The workspace on step `index`: the solution pruned to the blocks revealed
 * on steps 0..index. A block not yet revealed takes its whole subtree with it,
 * so a script must reveal a parent no later than its children (the scripts'
 * own tests hold them to it). Variables are always kept: a `variables_set`
 * with no variable declared would not load.
 */
export function demoStepState(script: DemoScript, index: number): WorkspaceState {
  checkIndex(script, index)
  const revealed = new Set(script.steps.slice(0, index + 1).flatMap((step) => step.reveal))
  const { blocks, ...rest } = script.solution
  if (!isObject(blocks)) return { ...rest }
  const top = topBlocksOf(script.solution)
    .map((block) => pruneBlock(block, revealed))
    .filter(isObject)
  return { ...rest, blocks: { ...blocks, blocks: top } }
}
