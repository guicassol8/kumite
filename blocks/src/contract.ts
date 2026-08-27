// Deliberately import-free, and reachable as `@kumite/blocks/contract`.
//
// Anything that pulls the package barrel gets Blockly with it — Blockly is not
// tree-shakeable, so a Web Worker that only needs these two names would carry
// ~770 kB of editor it never uses. Runners import this module; everyone else
// keeps using the barrel, which re-exports both names unchanged.

/** Contract with #4 and #20: the generated code is always `solve(input)`. */
export const SOLUTION_FUNCTION_NAME = 'solve'
export const SOLUTION_PARAM_NAME = 'input'
