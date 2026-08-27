// The `/contract` subpath, never the barrel: this module is what the worker
// bundle is built from, and the barrel would pull all of Blockly into it.
import { SOLUTION_FUNCTION_NAME, SOLUTION_PARAM_NAME } from '@kumite/blocks/contract'

/**
 * Instantiates the generated source and calls `solve(input)` once.
 *
 * Lives outside the worker file on purpose: it is the only part of the run with
 * logic, and here it is reachable from vitest, which has no `Worker`. The
 * worker is then a three-line envelope around this call.
 *
 * A fresh `Function` per call is what keeps runs independent — the generator
 * hoists `var` declarations above `solve`, so reusing one instantiation would
 * carry the previous example's accumulator into the next one.
 */
export function executeSolution(code: string, input: unknown): unknown {
  const run = new Function(
    SOLUTION_PARAM_NAME,
    `${code}\nreturn ${SOLUTION_FUNCTION_NAME}(${SOLUTION_PARAM_NAME});`,
  ) as (input: unknown) => unknown

  return run(input)
}
