import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'
import { afterEach, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { BlocksError } from './errors'
import { comentarioComQuebra } from './fixtures/comentario-com-quebra'
import { praticaDevolvaEntrada } from './fixtures/pratica-devolva-entrada'
import { praticaEPar } from './fixtures/pratica-e-par'
import { praticaSomaLista } from './fixtures/pratica-soma-lista'
import { raizDesabilitada } from './fixtures/raiz-desabilitada'
import { somaDosPares } from './fixtures/soma-dos-pares'
import { variavelChamadaInput } from './fixtures/variavel-chamada-input'
import { generateSolution } from './generate'
import { type BlockLocale, messagesFor } from './messages'
import type { WorkspaceState } from './toolbox'

/**
 * #380: `generateSolution` used to start with `defineKumiteBlocks(locale)`,
 * which assigns fresh definitions into `Blockly.Blocks` — so in the browser a
 * codegen call relabelled the *editor's* registry to whatever locale it was
 * given (or pt, by default), and every block created afterwards came out in
 * that language. These tests lock in that codegen never touches a registry
 * somebody already set up: it only registers the two kumite blocks when they
 * are missing (the judge's case), and the `locale` only localizes the refusal.
 */

type Registry = { root: unknown; input: unknown }

function registry(): Registry {
  return { root: Blockly.Blocks[ROOT_BLOCK_TYPE], input: Blockly.Blocks[INPUT_BLOCK_TYPE] }
}

/** The labels a block created right now gets — what the flyout would show. */
function labelsOfNewBlocks(): { root: string[]; input: string[] } {
  const workspace = new Blockly.Workspace()
  try {
    const texts = (type: string) =>
      workspace
        .newBlock(type)
        .inputList.flatMap((input) => input.fieldRow)
        .map((field) => field.getText())
    return { root: texts(ROOT_BLOCK_TYPE), input: texts(INPUT_BLOCK_TYPE) }
  } finally {
    workspace.dispose()
  }
}

function labelsOf(locale: BlockLocale): { root: string[]; input: string[] } {
  const messages = messagesFor(locale)
  return { root: [messages.solveTitle, messages.solveReturn], input: [messages.inputTitle] }
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

/** Every editor locale but pt, crossed with every way a caller can ask. */
const MATRIX: Array<[BlockLocale, BlockLocale | undefined]> = [
  ['es', undefined],
  ['es', 'pt'],
  ['es', 'en'],
  ['en', undefined],
  ['en', 'pt'],
  ['en', 'es'],
]

afterEach(() => {
  defineKumiteBlocks('pt')
})

describe('generateSolution leaves the block registry alone (#380)', () => {
  it.each(MATRIX)(
    'editor in %s, codegen with %s: same definitions, same labels',
    (editor, call) => {
      defineKumiteBlocks(editor)
      const before = registry()

      generateSolution(somaDosPares, call)

      expect(registry().root).toBe(before.root)
      expect(registry().input).toBe(before.input)
      expect(labelsOfNewBlocks()).toEqual(labelsOf(editor))
    },
  )

  it.each(MATRIX)(
    'editor in %s, refusal with %s: message follows the call, registry the editor',
    (editor, call) => {
      defineKumiteBlocks(editor)
      const before = registry()

      const error = expectBlocksError(() => generateSolution(raizDesabilitada, call))

      expect(error.code).toBe('disabled-block')
      expect(error.message).toBe(messagesFor(call ?? 'pt').errorDisabledBlock)
      expect(registry().root).toBe(before.root)
      expect(registry().input).toBe(before.input)
      expect(labelsOfNewBlocks()).toEqual(labelsOf(editor))
    },
  )

  it('registers the blocks in pt when nobody did — the judge — and only once', () => {
    defineKumiteBlocks('pt')
    const expected = generateSolution(somaDosPares)
    delete Blockly.Blocks[ROOT_BLOCK_TYPE]
    delete Blockly.Blocks[INPUT_BLOCK_TYPE]

    expect(generateSolution(somaDosPares)).toBe(expected)
    expect(labelsOfNewBlocks()).toEqual(labelsOf('pt'))

    const first = registry()
    generateSolution(somaDosPares, 'en')

    expect(registry().root).toBe(first.root)
    expect(registry().input).toBe(first.input)
    expect(labelsOfNewBlocks()).toEqual(labelsOf('pt'))
  })

  it.each([ROOT_BLOCK_TYPE, INPUT_BLOCK_TYPE])(
    'registers both blocks when only %s is missing',
    (missing) => {
      defineKumiteBlocks('pt')
      const expected = generateSolution(somaDosPares)
      delete Blockly.Blocks[missing]

      expect(generateSolution(somaDosPares, 'en')).toBe(expected)
      expect(Blockly.Blocks[missing]).toBeDefined()
      expect(labelsOfNewBlocks()).toEqual(labelsOf('pt'))
    },
  )

  it('registers the generators on every call, not only with the definitions', () => {
    // The registry may hold the blocks without their generators — filled by
    // something other than `defineKumiteBlocks`, or with `forBlock` reset since.
    // Codegen must not depend on whoever set the registry up.
    defineKumiteBlocks('pt')
    const expected = generateSolution(somaDosPares)
    defineKumiteBlocks('es')
    const before = registry()
    delete javascriptGenerator.forBlock[ROOT_BLOCK_TYPE]
    delete javascriptGenerator.forBlock[INPUT_BLOCK_TYPE]

    expect(generateSolution(somaDosPares)).toBe(expected)
    expect(registry().root).toBe(before.root)
    expect(registry().input).toBe(before.input)
  })

  it.each<[string, WorkspaceState]>([
    ['somaDosPares', somaDosPares],
    ['comentarioComQuebra', comentarioComQuebra],
    ['praticaDevolvaEntrada', praticaDevolvaEntrada],
    ['praticaEPar', praticaEPar],
    ['praticaSomaLista', praticaSomaLista],
    ['variavelChamadaInput', variavelChamadaInput],
  ])('%s generates the same code whatever locale the registry is in', (_, state) => {
    defineKumiteBlocks('pt')
    const inPt = generateSolution(state)

    for (const editor of ['en', 'es'] as const) {
      defineKumiteBlocks(editor)
      expect(generateSolution(state), editor).toBe(inPt)
    }
  })
})
