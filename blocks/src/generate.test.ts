import { javascriptGenerator } from 'blockly/javascript'
import { describe, expect, it, vi } from 'vitest'

import { ROOT_BLOCK_TYPE } from './blocks'
import { BlocksError } from './errors'
import { comentarioComQuebra } from './fixtures/comentario-com-quebra'
import { raizDesabilitada } from './fixtures/raiz-desabilitada'
import { somaDosPares } from './fixtures/soma-dos-pares'
import { variavelChamadaInput } from './fixtures/variavel-chamada-input'
import { generateSolution } from './generate'
import { emptyWorkspaceState, type WorkspaceState } from './toolbox'

const LINE_TERMINATORS = [
  String.fromCharCode(0x0d),
  String.fromCharCode(0x2028),
  String.fromCharCode(0x2029),
]

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

  it('renames a participant variable that collides with the generated names', () => {
    const code = generateSolution(variavelChamadaInput)

    // The participant's `input` and `solve` must not be the names the contract
    // owns, or they silently become the function and its parameter.
    const declarations = code
      .split('\n')
      .filter((line) => line.startsWith('var '))
      .join('\n')
    expect(declarations).not.toMatch(/\b(solve|input)\b/)

    // First item plus list length — the same answer under any naming.
    expect(instantiate(code)([10, 20, 30])).toBe(13)
  })

  it('neutralizes line terminators inside a block comment', () => {
    const code = generateSolution(comentarioComQuebra)

    for (const terminator of LINE_TERMINATORS) {
      expect(code).not.toContain(terminator)
    }
    // The comment survives as a comment; nothing it carries becomes code. The
    // fixture's payload is `throw`, so instantiating at all is the proof.
    expect(code).toContain('// sol')
    expect(instantiate(code)([])).toBe(7)
  })

  it('keeps a legitimate multi-line comment as comment lines', () => {
    const commented: WorkspaceState = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: ROOT_BLOCK_TYPE,
            id: 'raiz',
            icons: {
              comment: { text: 'primeira\nsegunda', pinned: false, height: 80, width: 160 },
            },
            inputs: { RETURN: { block: { type: 'kumite_input', id: 'entrada' } } },
          },
        ],
      },
    }

    const code = generateSolution(commented)

    // `\n` is left alone on purpose — Blockly prefixes each resulting line.
    expect(code).toContain('// primeira')
    expect(code).toContain('// segunda')
    expect(instantiate(code)(42)).toBe(42)
  })

  it('rejects a workspace whose root block is disabled', () => {
    const error = expectBlocksError(() => generateSolution(raizDesabilitada))

    expect(error.code).toBe('disabled-block')
  })

  it('rejects the legacy "enabled: false" serialization too', () => {
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: {
          languageVersion: 0,
          blocks: [{ type: ROOT_BLOCK_TYPE, id: 'raiz', enabled: false }],
        },
      }),
    )

    expect(error.code).toBe('disabled-block')
  })

  it('rejects a disabled block inside an otherwise valid solution', () => {
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: ROOT_BLOCK_TYPE,
              id: 'raiz',
              inputs: {
                RETURN: {
                  block: {
                    type: 'math_number',
                    id: 'resposta',
                    disabledReasons: ['manual'],
                    fields: { NUM: 7 },
                  },
                },
              },
            },
          ],
        },
      }),
    )

    expect(error.code).toBe('disabled-block')
  })

  it('refuses a "successful" generation that defines no solve function', () => {
    // The seam has to be `finish`: `generateSolution` calls `defineKumiteBlocks`
    // first, which overwrites `forBlock`, so patching the root generator would
    // be undone before it ran. This stands in for the next empty-success path
    // nobody has found yet — the one the guard exists for.
    const finish = vi.spyOn(javascriptGenerator, 'finish').mockReturnValue('\n\n\n')
    try {
      const error = expectBlocksError(() => generateSolution(somaDosPares))

      expect(error.code).toBe('invalid-generated-code')
    } finally {
      finish.mockRestore()
    }
  })

  it('refuses a source that carries the solve signature but does not parse', () => {
    // The signature check proves the *text* is there, not that the source is
    // callable. Blockly's `quote_` escapes `\\`, `\n` and `'` — not U+000D, a
    // line terminator JS honours — so a text field carrying one emits
    // `return 'a<CR>b';`: signature intact, `SyntaxError` on instantiation.
    // Reachable through a forged workspace, which is the trust boundary here.
    const error = expectBlocksError(() =>
      generateSolution({
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: ROOT_BLOCK_TYPE,
              id: 'raiz',
              inputs: {
                RETURN: {
                  block: {
                    type: 'text',
                    id: 'texto',
                    fields: { TEXT: `a${LINE_TERMINATORS[0]}b` },
                  },
                },
              },
            },
          ],
        },
      }),
    )

    expect(error.code).toBe('invalid-generated-code')
  })

  it('accepts the real source it produces', () => {
    // The other half of the guard: it must not reject what the generator
    // legitimately emits, comment lines and variable declarations included.
    expect(() => generateSolution(somaDosPares)).not.toThrow()
    expect(() => generateSolution(comentarioComQuebra)).not.toThrow()
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
