import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { VariableNameDialog, type VariableNameDialogProps } from './variable-name-dialog'

let workspace: Blockly.Workspace

function names() {
  return workspace
    .getVariableMap()
    .getAllVariables()
    .map((variable) => variable.getName())
}

function renderDialog(request: VariableNameDialogProps['request']) {
  const onClose = vi.fn()
  const utils = render(<VariableNameDialog request={request} onClose={onClose} />)
  return { onClose, ...utils }
}

function type(prefix: string, value: string) {
  fireEvent.change(screen.getByTestId(`${prefix}-input`), { target: { value } })
}

beforeEach(async () => {
  await i18n.changeLanguage('pt')
  workspace = new Blockly.Workspace()
})

afterEach(() => {
  cleanup()
  workspace.dispose()
})

describe('VariableNameDialog — create (#205)', () => {
  const create = () => ({ kind: 'create' as const, workspace })

  it('stays closed while there is no request', () => {
    renderDialog(null)

    expect(screen.queryByTestId('create-variable-dialog')).toBeNull()
    expect(screen.queryByTestId('rename-variable-dialog')).toBeNull()
  })

  it('opens with an empty, focused input', () => {
    renderDialog(create())

    const input = screen.getByTestId('create-variable-input') as HTMLInputElement
    expect(screen.getByTestId('create-variable-dialog')).toBeDefined()
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })

  it('refuses an empty name inside the dialog and creates nothing', () => {
    const { onClose } = renderDialog(create())

    type('create-variable', '   ')
    fireEvent.click(screen.getByTestId('create-variable-confirm'))

    expect(screen.getByTestId('create-variable-error').textContent).toBe(
      i18n.t('editor.createVariable.errors.empty'),
    )
    expect(screen.getByTestId('create-variable-dialog')).toBeDefined()
    expect(names()).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('refuses a duplicate name, naming the existing variable', () => {
    workspace.getVariableMap().createVariable('soma', '')
    const { onClose } = renderDialog(create())

    type('create-variable', 'Soma')
    fireEvent.submit(screen.getByTestId('create-variable-input'))

    const error = screen.getByTestId('create-variable-error')
    expect(error.getAttribute('role')).toBe('alert')
    expect(error.textContent).toContain('"soma"')
    expect(names()).toEqual(['soma'])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clears the error as soon as the name changes', () => {
    renderDialog(create())

    fireEvent.click(screen.getByTestId('create-variable-confirm'))
    expect(screen.queryByTestId('create-variable-error')).not.toBeNull()
    type('create-variable', 'x')

    expect(screen.queryByTestId('create-variable-error')).toBeNull()
  })

  it('closes on cancel without touching the workspace', () => {
    const { onClose } = renderDialog(create())

    type('create-variable', 'nova')
    fireEvent.click(screen.getByTestId('create-variable-cancel'))

    expect(onClose).toHaveBeenCalledOnce()
    expect(names()).toEqual([])
  })

  it("holds Blockly's ephemeral focus while open, so the flyout stays open behind it", () => {
    const giveBack = vi.fn()
    const take = vi.spyOn(Blockly.getFocusManager(), 'takeEphemeralFocus').mockReturnValue(giveBack)
    const { rerender, onClose } = renderDialog(create())

    expect(take).toHaveBeenCalledWith(screen.getByTestId('create-variable-dialog'))
    expect(giveBack).not.toHaveBeenCalled()

    rerender(<VariableNameDialog request={null} onClose={onClose} />)

    expect(giveBack).toHaveBeenCalledOnce()
    take.mockRestore()
  })

  it('creates the normalized variable and closes on a valid name', () => {
    const { onClose } = renderDialog(create())

    type('create-variable', '  nova   var ')
    fireEvent.click(screen.getByTestId('create-variable-confirm'))

    expect(names()).toEqual(['nova var'])
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('VariableNameDialog — rename (#335)', () => {
  let x: Blockly.IVariableModel<Blockly.IVariableState>
  let use: Blockly.Block

  beforeEach(() => {
    x = workspace.getVariableMap().createVariable('x', '')
    workspace.getVariableMap().createVariable('y', '')
    use = Blockly.serialization.blocks.append(
      { type: 'variables_get', fields: { VAR: { id: x.getId() } } },
      workspace,
    )
  })

  const rename = () => ({ kind: 'rename' as const, workspace, variableId: x.getId(), name: 'x' })

  it('opens with the current name in the title and an empty, focused input', () => {
    renderDialog(rename())

    const input = screen.getByTestId('rename-variable-input') as HTMLInputElement
    expect(screen.getByTestId('rename-variable-dialog').textContent).toContain(
      i18n.t('editor.renameVariable.title', { name: 'x' }),
    )
    expect(screen.queryByTestId('create-variable-dialog')).toBeNull()
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })

  it('refuses an empty name inside the dialog and renames nothing', () => {
    const { onClose } = renderDialog(rename())

    fireEvent.click(screen.getByTestId('rename-variable-confirm'))

    expect(screen.getByTestId('rename-variable-error').textContent).toBe(
      i18n.t('editor.createVariable.errors.empty'),
    )
    expect(names()).toEqual(['x', 'y'])
    expect(onClose).not.toHaveBeenCalled()
  })

  it("refuses another variable's name, even of the same type, instead of merging the two", () => {
    const { onClose } = renderDialog(rename())

    type('rename-variable', 'Y')
    fireEvent.click(screen.getByTestId('rename-variable-confirm'))

    expect(screen.getByTestId('rename-variable-error').textContent).toContain('"y"')
    expect(names()).toEqual(['x', 'y'])
    expect(use.getField('VAR')?.getText()).toBe('x')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renames on a case change of its own name', () => {
    const { onClose } = renderDialog(rename())

    type('rename-variable', 'X')
    fireEvent.click(screen.getByTestId('rename-variable-confirm'))

    expect(names()).toEqual(['X', 'y'])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renames the variable, and every block using it, on a valid name', () => {
    const { onClose } = renderDialog(rename())

    type('rename-variable', '  total ')
    fireEvent.submit(screen.getByTestId('rename-variable-input'))

    expect(names()).toEqual(['total', 'y'])
    expect(use.getField('VAR')?.getText()).toBe('total')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('just closes when the variable is gone by the time of the confirm', () => {
    const { onClose } = renderDialog(rename())
    workspace.getVariableMap().deleteVariable(x)

    type('rename-variable', 'total')
    fireEvent.click(screen.getByTestId('rename-variable-confirm'))

    expect(names()).toEqual(['y'])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on cancel without touching the workspace', () => {
    const { onClose } = renderDialog(rename())

    type('rename-variable', 'total')
    fireEvent.click(screen.getByTestId('rename-variable-cancel'))

    expect(onClose).toHaveBeenCalledOnce()
    expect(names()).toEqual(['x', 'y'])
  })
})
