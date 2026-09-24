import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { CreateVariableDialog } from './create-variable-dialog'

let workspace: Blockly.Workspace

function names() {
  return workspace
    .getVariableMap()
    .getAllVariables()
    .map((variable) => variable.getName())
}

function renderDialog(target: Blockly.Workspace | null = workspace) {
  const onClose = vi.fn()
  const utils = render(<CreateVariableDialog workspace={target} onClose={onClose} />)
  return { onClose, ...utils }
}

function type(value: string) {
  fireEvent.change(screen.getByTestId('create-variable-input'), { target: { value } })
}

beforeEach(async () => {
  await i18n.changeLanguage('pt')
  workspace = new Blockly.Workspace()
})

afterEach(() => {
  cleanup()
  workspace.dispose()
})

describe('CreateVariableDialog', () => {
  it('stays closed while there is no target workspace', () => {
    renderDialog(null)

    expect(screen.queryByTestId('create-variable-dialog')).toBeNull()
  })

  it('opens with an empty, focused input', () => {
    renderDialog()

    const input = screen.getByTestId('create-variable-input') as HTMLInputElement
    expect(screen.getByTestId('create-variable-dialog')).toBeDefined()
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })

  it('refuses an empty name inside the dialog and creates nothing', () => {
    const { onClose } = renderDialog()

    type('   ')
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
    const { onClose } = renderDialog()

    type('Soma')
    fireEvent.submit(screen.getByTestId('create-variable-input'))

    const error = screen.getByTestId('create-variable-error')
    expect(error.getAttribute('role')).toBe('alert')
    expect(error.textContent).toContain('"soma"')
    expect(names()).toEqual(['soma'])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clears the error as soon as the name changes', () => {
    renderDialog()

    fireEvent.click(screen.getByTestId('create-variable-confirm'))
    expect(screen.queryByTestId('create-variable-error')).not.toBeNull()
    type('x')

    expect(screen.queryByTestId('create-variable-error')).toBeNull()
  })

  it('closes on cancel without touching the workspace', () => {
    const { onClose } = renderDialog()

    type('nova')
    fireEvent.click(screen.getByTestId('create-variable-cancel'))

    expect(onClose).toHaveBeenCalledOnce()
    expect(names()).toEqual([])
  })

  it('creates the normalized variable and closes on a valid name', () => {
    const { onClose } = renderDialog()

    type('  nova   var ')
    fireEvent.click(screen.getByTestId('create-variable-confirm'))

    expect(names()).toEqual(['nova var'])
    expect(onClose).toHaveBeenCalledOnce()
  })
})
