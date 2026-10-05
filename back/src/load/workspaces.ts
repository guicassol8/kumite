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
 * expensive bad submission. The memory bomb is #137's.
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

// Parsed once through the route's own WorkspaceSchema: the body is checked
// against exactly what POST /submissions validates, and typed as its input.
export const WORKSPACES: Record<SubmissionKind, Workspace> = {
  correct: WorkspaceSchema.parse(somaDosPares),
  loop: WorkspaceSchema.parse(infiniteLoopWorkspace),
}
