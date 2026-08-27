import {
  emptyWorkspaceState,
  ROOT_BLOCK_TYPE,
  somaDosPares,
  type WorkspaceState,
} from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import { isEmptySolution } from './solution-state'

const rootWith = (inputs?: Record<string, unknown>): WorkspaceState => ({
  blocks: {
    languageVersion: 0,
    blocks: [{ type: ROOT_BLOCK_TYPE, id: 'raiz', x: 40, y: 40, ...(inputs ? { inputs } : {}) }],
  },
})

describe('isEmptySolution', () => {
  it('treats the freshly seeded workspace as empty', () => {
    expect(isEmptySolution(emptyWorkspaceState)).toBe(true)
  })

  it('treats a workspace with no state at all as empty', () => {
    expect(isEmptySolution({})).toBe(true)
  })

  it('does not treat the canonical solution as empty', () => {
    expect(isEmptySolution(somaDosPares)).toBe(false)
  })

  it('does not treat a root with only a return value as empty', () => {
    expect(
      isEmptySolution(
        rootWith({ RETURN: { block: { type: 'math_number', id: 'um', fields: { NUM: 1 } } } }),
      ),
    ).toBe(false)
  })

  it('does not treat a root with only a body as empty', () => {
    // Body but no return runs and fails with `obtido: null` — that is the
    // lesson about the missing "retornar", not a warning.
    expect(isEmptySolution(rootWith({ BODY: { block: { type: 'controls_if', id: 'se' } } }))).toBe(
      false,
    )
  })

  it('ignores blocks dropped outside the root', () => {
    const loose: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: ROOT_BLOCK_TYPE, id: 'raiz', x: 40, y: 40 },
          { type: 'math_number', id: 'solto', x: 300, y: 300, fields: { NUM: 7 } },
        ],
      },
    }

    expect(isEmptySolution(loose)).toBe(true)
  })

  it('is not empty when the root is missing, so codegen can report it', () => {
    const rootless: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'math_number', id: 'solto', x: 0, y: 0, fields: { NUM: 7 } }],
      },
    }

    expect(isEmptySolution(rootless)).toBe(false)
  })
})
