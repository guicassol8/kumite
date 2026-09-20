// Import-free on purpose, like `contract.ts`. Both ends of the curation read
// this table — the editor in `blocks.ts` and the judge in `generate.ts` — and
// `toolbox.ts` re-exports it next to `allowedBlockTypes`, which is where it
// belongs conceptually. Declaring it here instead of there is what keeps
// `blocks.ts ↔ toolbox.ts` from becoming an import cycle: `toolbox.ts` already
// reads `ROOT_BLOCK_TYPE` from `blocks.ts` at module scope.

/**
 * Dropdown values the curated toolbox subtracts from blocks it otherwise
 * offers, by block type and then by field name.
 *
 * `allowedBlockTypes` is granular per type and cannot express "this block, but
 * not that one mode of it", so this is its companion. It is applied twice, and
 * both are needed: `defineKumiteBlocks` strips the options so the editor never
 * offers them, and `generateSolution` refuses a serialized state that still
 * carries one — a state can arrive straight from the API, and Blockly loads an
 * unknown dropdown value silently as the field's default instead of failing.
 *
 * `lists_getIndex` with `WHERE=RANDOM` emits `listsGetRandomItem`, i.e.
 * `Math.floor(Math.random() * list.length)`: the same workspace passed "Run"
 * and failed "Submit", and re-judged differently on every attempt (#182). It
 * is the only non-deterministic option in the entire curated toolbox — see
 * `determinism.test.ts`, which is what keeps that true for the next block
 * someone adds to the toolbox.
 */
export const deniedFieldValues: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  lists_getIndex: { WHERE: ['RANDOM'] },
}
