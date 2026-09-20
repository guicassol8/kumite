import type { WorkspaceState } from '../toolbox'

/**
 * Adversarial fixture for #182: a solution that reads a *random* item of the
 * input list — `lists_getIndex` with `WHERE: "RANDOM"`, the one option of the
 * curated toolbox whose generated code is not deterministic.
 *
 * It is written by hand, not saved from the editor, and that is the point: the
 * editor no longer offers the option, so this is the shape that arrives from a
 * direct POST to the API. Loading it into a workspace would hide the bug —
 * Blockly takes a value its dropdown does not offer and silently falls back to
 * the field's default — which is why the judge inspects the raw state.
 *
 * Before the refusal, this workspace passed "Run" and failed "Submit", and
 * re-judged differently on every attempt.
 */
export const indiceAleatorio: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'raiz',
        x: 40,
        y: 40,
        inputs: {
          RETURN: {
            block: {
              type: 'lists_getIndex',
              id: 'sorteia',
              fields: { MODE: 'GET', WHERE: 'RANDOM' },
              inputs: {
                VALUE: { block: { type: 'kumite_input', id: 'entrada' } },
              },
            },
          },
        },
      },
    ],
  },
}
