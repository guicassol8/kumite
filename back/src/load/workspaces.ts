import { somaDosPares, type WorkspaceState } from '@kumite/blocks'

import { type Workspace, WorkspaceSchema } from '../modules/judge/judge.schema'

import type { SubmissionKind } from './verdict'

// The workspaces the harness submits (#136). Instances of workspaces built
// from the curated toolbox — never new block definitions, which live only in
// @kumite/blocks (AGENTS.md).

/** The canonical correct solution for "Soma dos Pares". */
export { somaDosPares }

/**
 * `while (true) {}` and a return that is never reached: codegen accepts it
 * (every block is in the toolbox), and the judge must answer timeout on
 * every case. Holds a judge slot for JUDGE_TIMEOUT_MS per case — the
 * expensive bad submission.
 */
export const infiniteLoopWorkspace: WorkspaceState = {
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
              type: 'controls_whileUntil',
              id: 'paraSempre',
              fields: { MODE: 'WHILE' },
              inputs: {
                BOOL: { block: { type: 'logic_boolean', id: 'verdade', fields: { BOOL: 'TRUE' } } },
              },
            },
          },
          RETURN: { block: { type: 'math_number', id: 'nunca', fields: { NUM: 0 } } },
        },
      },
    ],
  },
}

/**
 * `s ← "kumite"; while (true) { s ← s + s }` (#137): the string doubles every
 * turn, so the QuickJS runtime's memory limit (64 MiB by default) is hit in
 * about 25 turns, long before the time limit — the judge must answer
 * runtime_error, detail "out of memory", on every case. `text_join` is the
 * curated toolbox's only way to grow a value: it has no list push.
 */
export const memoryBombWorkspace: WorkspaceState = {
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
              id: 'semente',
              fields: { VAR: { id: 'varTexto' } },
              inputs: {
                VALUE: { block: { type: 'text', id: 'kumite', fields: { TEXT: 'kumite' } } },
              },
              next: {
                block: {
                  type: 'controls_whileUntil',
                  id: 'paraSempre',
                  fields: { MODE: 'WHILE' },
                  inputs: {
                    BOOL: {
                      block: { type: 'logic_boolean', id: 'verdade', fields: { BOOL: 'TRUE' } },
                    },
                    DO: {
                      block: {
                        type: 'variables_set',
                        id: 'dobra',
                        fields: { VAR: { id: 'varTexto' } },
                        inputs: {
                          VALUE: {
                            block: {
                              type: 'text_join',
                              id: 'junta',
                              extraState: { itemCount: 2 },
                              inputs: {
                                ADD0: {
                                  block: {
                                    type: 'variables_get',
                                    id: 'esquerda',
                                    fields: { VAR: { id: 'varTexto' } },
                                  },
                                },
                                ADD1: {
                                  block: {
                                    type: 'variables_get',
                                    id: 'direita',
                                    fields: { VAR: { id: 'varTexto' } },
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
          RETURN: { block: { type: 'math_number', id: 'nunca', fields: { NUM: 0 } } },
        },
      },
    ],
  },
  variables: [{ name: 'texto', id: 'varTexto' }],
}

// Parsed once through the route's own WorkspaceSchema: the body is checked
// against exactly what POST /submissions validates, and typed as its input.
export const WORKSPACES: Record<SubmissionKind, Workspace> = {
  correct: WorkspaceSchema.parse(somaDosPares),
  loop: WorkspaceSchema.parse(infiniteLoopWorkspace),
  memory: WorkspaceSchema.parse(memoryBombWorkspace),
}
