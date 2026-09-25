import type { WorkspaceState } from '../toolbox'

/**
 * Reference solution of practice problem 3 (#210), "Soma da lista": create
 * `total`, start it at 0, add every `numero` of the `entrada` list to it and
 * return it. Teaches Laços, Listas and creating a variable.
 */
export const praticaSomaLista: WorkspaceState = {
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
              id: 'zeraTotal',
              fields: { VAR: { id: 'varTotal' } },
              inputs: {
                VALUE: { block: { type: 'math_number', id: 'zero', fields: { NUM: 0 } } },
              },
              next: {
                block: {
                  type: 'controls_forEach',
                  id: 'paraCada',
                  fields: { VAR: { id: 'varNumero' } },
                  inputs: {
                    LIST: { block: { type: 'kumite_input', id: 'entrada' } },
                    DO: {
                      block: {
                        type: 'variables_set',
                        id: 'acumula',
                        fields: { VAR: { id: 'varTotal' } },
                        inputs: {
                          VALUE: {
                            block: {
                              type: 'math_arithmetic',
                              id: 'totalMais',
                              fields: { OP: 'ADD' },
                              inputs: {
                                A: {
                                  block: {
                                    type: 'variables_get',
                                    id: 'leTotal',
                                    fields: { VAR: { id: 'varTotal' } },
                                  },
                                },
                                B: {
                                  block: {
                                    type: 'variables_get',
                                    id: 'leNumero',
                                    fields: { VAR: { id: 'varNumero' } },
                                  },
                                },
                              },
                            },
                          },
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
              type: 'variables_get',
              id: 'devolveTotal',
              fields: { VAR: { id: 'varTotal' } },
            },
          },
        },
      },
    ],
  },
  variables: [
    { name: 'total', id: 'varTotal' },
    { name: 'numero', id: 'varNumero' },
  ],
}
