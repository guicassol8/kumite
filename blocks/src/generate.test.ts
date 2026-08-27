import { describe, expect, it } from 'vitest'

import { ROOT_BLOCK_TYPE } from './blocks'
import { BlocksError } from './errors'
import { somaDosPares } from './fixtures/soma-dos-pares'
import { generateSolution } from './generate'
import { emptyWorkspaceState, type WorkspaceState } from './toolbox'

type Solver = (input: unknown) => unknown

// The whole point of the package: the generated source is real JS. Instantiating
// it here is what proves the acceptance criterion, not a snapshot.
function instantiate(code: string): Solver {
  return new Function(`${code}\nreturn solve;`)() as Solver
}

function expectBlocksError(run: () => unknown): BlocksError {
  try {
    run()
  } catch (error) {
    if (error instanceof BlocksError) return error
    throw error
  }
  throw new Error('expected generateSolution to throw a BlocksError')
}

describe('generateSolution', () => {
  it('emits a solve(input) function for the empty workspace', () => {
    const code = generateSolution(emptyWorkspaceState)

    expect(code).toContain('function solve(input)')
    expect(instantiate(code)([])).toBeNull()
  })

  it('reads the input block as the solve parameter', () => {
    const identity: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: ROOT_BLOCK_TYPE,
            id: 'raiz',
            inputs: { RETURN: { block: { type: 'kumite_input', id: 'entrada' } } },
          },
        ],
      },
    }

    expect(instantiate(generateSolution(identity))(42)).toBe(42)
  })

  it('keeps the generated names fixed when the locale changes', () => {
    const code = generateSolution(emptyWorkspaceState, 'es')

    expect(code).toContain('function solve(input)')
  })

  it('rejects a malformed workspace', () => {
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: { languageVersion: 0, blocks: [{ semTipo: true }] },
      }),
    )

    expect(error.code).toBe('malformed-workspace')
  })

  it('rejects a workspace without the root block', () => {
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'math_number', id: 'solto', fields: { NUM: 1 } }],
        },
      }),
    )

    expect(error.code).toBe('missing-root')
  })

  it('rejects a workspace with two root blocks', () => {
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: ROOT_BLOCK_TYPE, id: 'raizA', x: 0, y: 0 },
            { type: ROOT_BLOCK_TYPE, id: 'raizB', x: 0, y: 200 },
          ],
        },
      }),
    )

    expect(error.code).toBe('duplicate-root')
  })

  it('rejects a block outside the curated allowlist, naming it', () => {
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: ROOT_BLOCK_TYPE,
              id: 'raiz',
              inputs: {
                BODY: { block: { type: 'text_print', id: 'proibido' } },
              },
            },
          ],
        },
      }),
    )

    expect(error.code).toBe('block-not-allowed')
    expect(error.blockType).toBe('text_print')
    expect(error.message).toContain('text_print')
  })
})

describe('the "soma dos pares" fixture', () => {
  it('generates a function that sums the even numbers of the input', () => {
    const solve = instantiate(generateSolution(somaDosPares))

    expect(solve([1, 2, 3, 4])).toBe(6)
    expect(solve([])).toBe(0)
    expect(solve([1, 3, 5])).toBe(0)
  })
})
