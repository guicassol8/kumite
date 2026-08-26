import type { WorkspaceState } from '../toolbox'

/**
 * Canonical solution built only from the curated toolbox: sum the even numbers
 * of the input list. It is the shared fixture for the package, and #20 reuses
 * it for the editor↔judge parity test — keep it in sync with nothing, it is
 * the source of truth.
 */
export const somaDosPares: WorkspaceState = {
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
              id: 'zeraSoma',
              fields: { VAR: { id: 'varSoma' } },
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
                        type: 'controls_if',
                        id: 'sePar',
                        inputs: {
                          IF0: {
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
                                      DIVIDEND: {
                                        block: {
                                          type: 'variables_get',
                                          id: 'leNumero',
                                          fields: { VAR: { id: 'varNumero' } },
                                        },
                                      },
                                      DIVISOR: {
                                        block: {
                                          type: 'math_number',
                                          id: 'dois',
                                          fields: { NUM: 2 },
                                        },
                                      },
                                    },
                                  },
                                },
                                B: {
                                  block: { type: 'math_number', id: 'zeroCmp', fields: { NUM: 0 } },
                                },
                              },
                            },
                          },
                          DO0: {
                            block: {
                              type: 'variables_set',
                              id: 'acumula',
                              fields: { VAR: { id: 'varSoma' } },
                              inputs: {
                                VALUE: {
                                  block: {
                                    type: 'math_arithmetic',
                                    id: 'somaMais',
                                    fields: { OP: 'ADD' },
                                    inputs: {
                                      A: {
                                        block: {
                                          type: 'variables_get',
                                          id: 'leSoma',
                                          fields: { VAR: { id: 'varSoma' } },
                                        },
                                      },
                                      B: {
                                        block: {
                                          type: 'variables_get',
                                          id: 'leNumeroDeNovo',
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
              },
            },
          },
          RETURN: {
            block: { type: 'variables_get', id: 'devolveSoma', fields: { VAR: { id: 'varSoma' } } },
          },
        },
      },
    ],
  },
  variables: [
    { name: 'soma', id: 'varSoma' },
    { name: 'numero', id: 'varNumero' },
  ],
}
