import { ROOT_BLOCK_TYPE, type WorkspaceState } from '@kumite/blocks'
import { act, cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import i18n from '@/i18n'
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

function fieldTexts(handle: BlocklyWorkspaceHandle, type: string) {
  const workspace = handle.getWorkspace()
  if (!workspace) throw new Error('the workspace was not injected')
  return workspace
    .getBlocksByType(type, false)
    .flatMap((block) => block.inputList.flatMap((input) => input.fieldRow))
    .map((field) => field.getText())
}

function renderHost() {
  const workspaceRef = createRef<BlocklyWorkspaceHandle>()
  function Host() {
    const toolbox = useBlocklyLocale(workspaceRef)
    return (
      <BlocklyWorkspace ref={workspaceRef} toolbox={toolbox} initialState={fixtureWithExtraBlock} />
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
})
