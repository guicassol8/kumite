import type { WorkspaceState } from '../toolbox'

/**
 * Reference solution of practice problem 2 (#210), "É par?": `retornar` gets
 * the comparison `(entrada % 2) = 0` directly — a condition returned as a
 * value, no `se` block. Decided with the user in the plan: the root has a
 * single `retornar` and the toolbox has no ternary, so an `if` would need a
 * variable, which is problem 3's lesson. Teaches Lógica + Matemática.
 */
export const praticaEPar: WorkspaceState = {
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
              type: 'logic_compare',
              id: 'restoZero',
              fields: { OP: 'EQ' },
              inputs: {
                A: {
                  block: {
                    type: 'math_modulo',
                    id: 'resto',
                    inputs: {
                      DIVIDEND: { block: { type: 'kumite_input', id: 'entrada' } },
                      DIVISOR: { block: { type: 'math_number', id: 'dois', fields: { NUM: 2 } } },
                    },
                  },
                },
                B: { block: { type: 'math_number', id: 'zero', fields: { NUM: 0 } } },
              },
            },
          },
        },
      },
    ],
  },
}
