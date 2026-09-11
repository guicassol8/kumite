import type { WorkspaceState } from '../toolbox'

/**
 * Adversarial fixture for #181 (finding #8): the participant named their
 * variables `input` and `solve` — the two identifiers the generated source
 * owns by contract (`contract.ts`).
 *
 * The solution reads the real input twice: the first item plus the list
 * length. `solve([10, 20, 30])` is therefore `10 + 3 === 13` under any naming.
 * Before the generator reserved the contract names, the participant's `input`
 * *was* the function parameter, so `input = input[0]` clobbered it and the
 * length came back `undefined` — a silent `NaN` with no error anywhere.
 */
export const variavelChamadaInput: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'raiz',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'guardaPrimeiro',
              fields: { VAR: { id: 'varInput' } },
              inputs: {
                VALUE: {
                  block: {
                    type: 'lists_getIndex',
                    id: 'primeiro',
                    fields: { MODE: 'GET', WHERE: 'FIRST' },
                    inputs: {
                      VALUE: { block: { type: 'kumite_input', id: 'entradaPrimeiro' } },
                    },
                  },
                },
              },
              next: {
                block: {
                  type: 'variables_set',
                  id: 'guardaTamanho',
                  fields: { VAR: { id: 'varSolve' } },
                  inputs: {
                    VALUE: {
                      block: {
                        type: 'lists_length',
                        id: 'tamanho',
                        inputs: {
                          VALUE: { block: { type: 'kumite_input', id: 'entradaTamanho' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          RETURN: {
            block: {
              type: 'math_arithmetic',
              id: 'soma',
              fields: { OP: 'ADD' },
              inputs: {
                A: {
                  block: {
                    type: 'variables_get',
                    id: 'leInput',
                    fields: { VAR: { id: 'varInput' } },
                  },
                },
                B: {
                  block: {
                    type: 'variables_get',
                    id: 'leSolve',
                    fields: { VAR: { id: 'varSolve' } },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
  variables: [
    { name: 'input', id: 'varInput' },
    { name: 'solve', id: 'varSolve' },
  ],
}
