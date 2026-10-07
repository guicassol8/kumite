import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { DeleteVariableDialog, type DeleteVariableDialogProps } from './delete-variable-dialog'

let workspace: Blockly.Workspace
let x: Blockly.IVariableModel<Blockly.IVariableState>

function names() {
  return workspace
    .getVariableMap()
    .getAllVariables()
    .map((variable) => variable.getName())
}

function renderDialog(request: DeleteVariableDialogProps['request']) {
  const onClose = vi.fn()
  const utils = render(<DeleteVariableDialog request={request} onClose={onClose} />)
  return { onClose, ...utils }
}

const remove = () => ({
  kind: 'delete' as const,
  workspace,
  variableId: x.getId(),
  name: 'x',
  uses: 2,
})

beforeEach(async () => {
  await i18n.changeLanguage('pt')
  workspace = new Blockly.Workspace()
  x = workspace.getVariableMap().createVariable('x', '')
  for (const type of ['variables_set', 'variables_get']) {
    Blockly.serialization.blocks.append({ type, fields: { VAR: { id: x.getId() } } }, workspace)
  }
})

afterEach(() => {
  cleanup()
  workspace.dispose()
})

describe('DeleteVariableDialog (#335)', () => {
  it('stays closed while there is no request', () => {
    renderDialog(null)

    expect(screen.queryByTestId('delete-variable-dialog')).toBeNull()
  })

  it('names the variable and how many blocks go with it', () => {
    renderDialog(remove())

    const dialog = screen.getByTestId('delete-variable-dialog')
    expect(dialog.textContent).toContain(i18n.t('editor.deleteVariable.title', { name: 'x' }))
    expect(dialog.textContent).toContain(i18n.t('editor.deleteVariable.description', { uses: 2 }))
    expect(dialog.textContent).toContain('"x"')
    expect(dialog.textContent).toContain('2 blocos')
  })

  it('closes on cancel without touching the workspace', () => {
    const { onClose } = renderDialog(remove())

    fireEvent.click(screen.getByTestId('delete-variable-cancel'))

    expect(onClose).toHaveBeenCalledOnce()
    expect(names()).toEqual(['x'])
    expect(workspace.getAllBlocks(false)).toHaveLength(2)
  })

  it('closes on Escape without touching the workspace', () => {
    const { onClose } = renderDialog(remove())

    fireEvent.keyDown(screen.getByTestId('delete-variable-dialog'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
    expect(names()).toEqual(['x'])
    expect(workspace.getAllBlocks(false)).toHaveLength(2)
  })

  it('deletes the variable and every block using it on confirm', () => {
    const { onClose } = renderDialog(remove())

    fireEvent.click(screen.getByTestId('delete-variable-confirm'))

    expect(names()).toEqual([])
    expect(workspace.getAllBlocks(false)).toHaveLength(0)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('just closes when the variable is gone by the time of the confirm', () => {
    const { onClose } = renderDialog(remove())
    workspace.getVariableMap().deleteVariable(x)

    fireEvent.click(screen.getByTestId('delete-variable-confirm'))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
