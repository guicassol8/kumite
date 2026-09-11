import type { WorkspaceState } from '../toolbox'

/**
 * Adversarial fixture for #181 (finding #15): the root block turned off via the
 * editor's "Disable Block" context-menu item.
 *
 * `disabledReasons: ['manual']` is what Blockly 13 actually serializes for that
 * gesture (the older `enabled: false` still loads, and is covered by its own
 * test). The `RETURN` input is connected on purpose: a solution the editor
 * would consider empty never reaches codegen, so an empty one would prove
 * nothing. Before the guard, generation "succeeded" with `"\n\n\n"` — no
 * `solve` at all, and every case failing with `solve is not defined`.
 */
export const raizDesabilitada: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'raiz',
        x: 40,
        y: 40,
        disabledReasons: ['manual'],
        inputs: {
          RETURN: { block: { type: 'math_number', id: 'resposta', fields: { NUM: 7 } } },
        },
      },
    ],
  },
}
