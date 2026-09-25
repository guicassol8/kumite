import type { WorkspaceState } from '../toolbox'

/**
 * Reference solution of practice problem 1 (#210), "Devolva a entrada": the
 * `resolver` block returns its `entrada` untouched. No body, no logic — the
 * three blocks every solution starts from. The back seeds the problem with
 * this as its proof of solvability; the demo (#212) replays it.
 */
export const praticaDevolvaEntrada: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'raiz',
        x: 40,
        y: 40,
        inputs: {
          RETURN: { block: { type: 'kumite_input', id: 'entrada' } },
        },
      },
    ],
  },
}
