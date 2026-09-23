import * as Blockly from 'blockly'
import * as en from 'blockly/msg/en'
import * as es from 'blockly/msg/es'
import * as ptBr from 'blockly/msg/pt-br'
import { afterEach, describe, expect, it } from 'vitest'

import { defineKumiteBlocks, INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from './blocks'
import { variavelChamadaInput } from './fixtures/variavel-chamada-input'
import { generateSolution } from './generate'
import { type BlockLocale, messagesFor } from './messages'
import type { WorkspaceState } from './toolbox'

/**
 * #202: an organizer saw the input block "turn into a variable" and change its
 * name when the language changed. The reproduction ruled out any real rename —
 * only the input block's *label* is translated (`entrada`/`entrada`/`input`),
 * on purpose. These tests lock that in: switching locale the way the editor
 * does (`useBlocklyLocale`: `setLocale` + `defineKumiteBlocks`, then
 * `save → clear → load` of the live workspace) never touches a variable's id
 * or name, and never changes the generated solution.
 */

// Same interop cast as `front/src/lib/blockly-setup.ts`: the namespace import
// carries a synthetic `default` that `setLocale`'s signature rejects.
const PACKS: Record<BlockLocale, Record<string, string>> = {
  pt: ptBr as unknown as Record<string, string>,
  es: es as unknown as Record<string, string>,
  en: en as unknown as Record<string, string>,
}

function applyLocale(locale: BlockLocale): void {
  Blockly.setLocale(PACKS[locale])
  defineKumiteBlocks(locale)
}

/**
 * `soma ← entrada; retornar soma`, plus variables created by hand whose names
 * are the most confusing possible here: `input` (the en label and the code
 * parameter) and `entrada` (the pt/es label).
 */
const somaDaEntrada: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'raiz',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'guardaSoma',
              fields: { VAR: { id: 'varSoma' } },
              inputs: {
                VALUE: { block: { type: INPUT_BLOCK_TYPE, id: 'blocoEntrada' } },
              },
            },
          },
          RETURN: {
            block: { type: 'variables_get', id: 'leSoma', fields: { VAR: { id: 'varSoma' } } },
          },
        },
      },
      { type: INPUT_BLOCK_TYPE, id: 'entradaSolta', x: 300, y: 40 },
    ],
  },
  variables: [
    { name: 'soma', id: 'varSoma' },
    { name: 'input', id: 'varInput' },
    { name: 'entrada', id: 'varEntrada' },
  ],
}

type Snapshot = {
  variables: string[]
  varFields: string[]
  inputIds: string[]
  inputLabels: string[]
}

function snapshot(workspace: Blockly.Workspace): Snapshot {
  const variables = workspace
    .getVariableMap()
    .getAllVariables()
    .map((variable) => `${variable.getId()}=${variable.getName()}`)
    .sort()
  const varFields = workspace
    .getAllBlocks(true)
    .filter((block) => block.type === 'variables_get' || block.type === 'variables_set')
    .map((block) => `${block.id}->${block.getFieldValue('VAR')}`)
  const inputBlocks = workspace.getBlocksByType(INPUT_BLOCK_TYPE, true)
  return {
    variables,
    varFields,
    inputIds: inputBlocks.map((block) => block.id),
    inputLabels: inputBlocks.flatMap((block) =>
      block.inputList.flatMap((input) => input.fieldRow).map((field) => field.getText()),
    ),
  }
}

/** What `useBlocklyLocale` does to the live workspace on a language change. */
function switchLocale(workspace: Blockly.Workspace, locale: BlockLocale): void {
  applyLocale(locale)
  const state = Blockly.serialization.workspaces.save(workspace)
  workspace.clear()
  Blockly.serialization.workspaces.load(state, workspace)
}

afterEach(() => {
  applyLocale('pt')
})

describe('locale switch keeps variable identity (#202)', () => {
  it('pt → en → es → pt renames no variable and only relabels the input block', () => {
    applyLocale('pt')
    const workspace = new Blockly.Workspace()
    try {
      Blockly.serialization.workspaces.load(somaDaEntrada, workspace)
      const before = snapshot(workspace)

      expect(before.variables).toEqual(['varEntrada=entrada', 'varInput=input', 'varSoma=soma'])
      expect(before.varFields).toEqual(['guardaSoma->varSoma', 'leSoma->varSoma'])
      expect(before.inputIds).toEqual(['blocoEntrada', 'entradaSolta'])

      for (const locale of ['en', 'es', 'pt'] as const) {
        switchLocale(workspace, locale)
        const after = snapshot(workspace)

        expect(after.variables, locale).toEqual(before.variables)
        expect(after.varFields, locale).toEqual(before.varFields)
        expect(after.inputIds, locale).toEqual(before.inputIds)
        expect(after.inputLabels, locale).toEqual([
          messagesFor(locale).inputTitle,
          messagesFor(locale).inputTitle,
        ])
      }
    } finally {
      workspace.dispose()
    }
  })

  it('the serialized state does not change across a locale switch — labels are not saved', () => {
    applyLocale('pt')
    const workspace = new Blockly.Workspace()
    try {
      Blockly.serialization.workspaces.load(somaDaEntrada, workspace)
      const saved = Blockly.serialization.workspaces.save(workspace)

      for (const locale of ['en', 'es', 'pt'] as const) {
        switchLocale(workspace, locale)
        expect(Blockly.serialization.workspaces.save(workspace), locale).toEqual(saved)
      }
    } finally {
      workspace.dispose()
    }
  })

  it.each([
    ['somaDaEntrada', somaDaEntrada],
    ['variavelChamadaInput', variavelChamadaInput],
  ])('%s saved in pt generates byte-identical code when restored in en and es', (_, state) => {
    // The autosave is written in whatever locale the participant was in; the
    // restore may happen under another one.
    applyLocale('pt')
    const workspace = new Blockly.Workspace()
    let savedInPt: WorkspaceState
    try {
      Blockly.serialization.workspaces.load(state, workspace)
      savedInPt = Blockly.serialization.workspaces.save(workspace) as WorkspaceState
    } finally {
      workspace.dispose()
    }

    const inPt = generateSolution(savedInPt, 'pt')
    for (const locale of ['en', 'es'] as const) {
      applyLocale(locale)
      expect(generateSolution(savedInPt, locale), locale).toBe(inPt)
    }
  })
})
