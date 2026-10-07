import {
  CREATE_VARIABLE_BUTTON_KEY,
  INPUT_BLOCK_TYPE,
  ROOT_BLOCK_TYPE,
  type WorkspaceState,
} from '@kumite/blocks'
import { act, cleanup, render, screen } from '@testing-library/react'
import * as Blockly from 'blockly'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import i18n from '@/i18n'
import type { VariableDialogRequest } from '@/lib/blockly-variable-field'
import { useBlocklyLocale } from './use-blockly-locale'

const fixtureWithExtraBlock: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: ROOT_BLOCK_TYPE, id: 'kumiteSolveRoot', x: 40, y: 40 },
      { type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } },
    ],
  },
}

// #202: `soma ← entrada; retornar soma`, plus a hand-made variable called
// `input` — the en label of the input block and the most confusing name here.
const fixtureWithVariables: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'kumiteSolveRoot',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'guardaSoma',
              fields: { VAR: { id: 'varSoma' } },
              inputs: { VALUE: { block: { type: INPUT_BLOCK_TYPE, id: 'blocoEntrada' } } },
            },
          },
          RETURN: {
            block: { type: 'variables_get', id: 'leSoma', fields: { VAR: { id: 'varSoma' } } },
          },
        },
      },
    ],
  },
  variables: [
    { name: 'soma', id: 'varSoma' },
    { name: 'input', id: 'varInput' },
  ],
}

function variables(handle: BlocklyWorkspaceHandle) {
  const workspace = handle.getWorkspace()
  if (!workspace) throw new Error('the workspace was not injected')
  return workspace
    .getVariableMap()
    .getAllVariables()
    .map((variable) => `${variable.getId()}=${variable.getName()}`)
    .sort()
}

function fieldTexts(handle: BlocklyWorkspaceHandle, type: string) {
  const workspace = handle.getWorkspace()
  if (!workspace) throw new Error('the workspace was not injected')
  return workspace
    .getBlocksByType(type, false)
    .flatMap((block) => block.inputList.flatMap((input) => input.fieldRow))
    .map((field) => field.getText())
}

function renderHost(
  initialState: WorkspaceState = fixtureWithExtraBlock,
  onVariableDialog: (request: VariableDialogRequest) => void = () => {},
) {
  const workspaceRef = createRef<BlocklyWorkspaceHandle>()
  function Host() {
    const { toolbox, onReady } = useBlocklyLocale(workspaceRef, onVariableDialog)
    return (
      <BlocklyWorkspace
        ref={workspaceRef}
        toolbox={toolbox}
        initialState={initialState}
        onReady={onReady}
      />
    )
  }
  const utils = render(<Host />)
  const handle = workspaceRef.current
  if (!handle) throw new Error('the imperative handle was not attached')
  return { handle, ...utils }
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('useBlocklyLocale', () => {
  it('applies the active UI language to the toolbox and the root block on mount', async () => {
    await i18n.changeLanguage('es')

    const { handle } = renderHost()

    expect(screen.getByText('Bucles')).toBeDefined()
    expect(fieldTexts(handle, ROOT_BLOCK_TYPE)).toEqual(
      expect.arrayContaining(['resolver', 'devolver']),
    )
  })

  it('re-renders the toolbox and blocks when the language changes, keeping the workspace content', async () => {
    await i18n.changeLanguage('es')
    const { handle } = renderHost()

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(screen.getByText('Loops')).toBeDefined()
    expect(fieldTexts(handle, ROOT_BLOCK_TYPE)).toEqual(expect.arrayContaining(['solve', 'return']))
    expect(handle.getWorkspace()?.getBlocksByType('math_number', false)).toHaveLength(1)
    expect(handle.serialize().blocks?.blocks).toHaveLength(2)
  })

  it("routes the create-variable button to the caller's handler, also after a language switch (#205)", async () => {
    const onVariableDialog = vi.fn()
    const { handle } = renderHost(fixtureWithExtraBlock, onVariableDialog)
    const workspace = handle.getWorkspace()
    if (!workspace) throw new Error('the workspace was not injected')
    const button = { getTargetWorkspace: () => workspace } as unknown as Blockly.FlyoutButton

    workspace.getButtonCallback(CREATE_VARIABLE_BUTTON_KEY)?.(button)
    expect(onVariableDialog).toHaveBeenLastCalledWith({ kind: 'create', workspace })

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    workspace.getButtonCallback(CREATE_VARIABLE_BUTTON_KEY)?.(button)

    expect(onVariableDialog).toHaveBeenCalledTimes(2)
  })

  it("routes a variable dropdown's rename to the caller's handler, also after a language switch (#335)", async () => {
    const onVariableDialog = vi.fn()
    const { handle } = renderHost(fixtureWithVariables, onVariableDialog)
    const workspace = handle.getWorkspace()
    if (!workspace) throw new Error('the workspace was not injected')
    const rename = () => {
      // The language switch rebuilds every block, so look the field up each time.
      const field = workspace.getBlockById('leSoma')?.getField('VAR') as unknown as {
        onItemSelected_(menu: Blockly.Menu, item: Blockly.MenuItem): void
      }
      const item = { getValue: () => Blockly.RENAME_VARIABLE_ID } as unknown as Blockly.MenuItem
      field.onItemSelected_({} as Blockly.Menu, item)
    }
    const request = { kind: 'rename', workspace, variableId: 'varSoma', name: 'soma' }

    rename()
    expect(onVariableDialog).toHaveBeenLastCalledWith(request)

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    rename()

    expect(onVariableDialog).toHaveBeenCalledTimes(2)
    expect(onVariableDialog).toHaveBeenLastCalledWith(request)
  })

  it('renames no variable when the language changes, only the input block label (#202)', async () => {
    const { handle } = renderHost(fixtureWithVariables)
    const before = handle.serialize()

    expect(variables(handle)).toEqual(['varInput=input', 'varSoma=soma'])
    expect(fieldTexts(handle, INPUT_BLOCK_TYPE)).toEqual(['entrada'])

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(handle.serialize()).toEqual(before)
    expect(variables(handle)).toEqual(['varInput=input', 'varSoma=soma'])
    expect(fieldTexts(handle, INPUT_BLOCK_TYPE)).toEqual(['input'])

    await act(async () => {
      await i18n.changeLanguage('es')
    })

    expect(handle.serialize()).toEqual(before)
    expect(variables(handle)).toEqual(['varInput=input', 'varSoma=soma'])
    expect(fieldTexts(handle, INPUT_BLOCK_TYPE)).toEqual(['entrada'])
  })
})
