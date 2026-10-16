import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import {
  installVariableField,
  KumiteFieldVariable,
  setVariableDialogHandler,
} from '@/lib/blockly-variable-field'

let workspace: Blockly.Workspace
let x: Blockly.IVariableModel<Blockly.IVariableState>
let prompt: Mock<typeof Blockly.dialog.prompt>
let confirm: Mock<typeof Blockly.dialog.confirm>

/** A block using `x` through its `VAR` field (`variables_get`, `variables_set`).
 * Built from state, as a load does: `newBlock` would first create Blockly's
 * default "item" variable. */
function useOfX(type: 'variables_get' | 'variables_set' = 'variables_get'): Blockly.Block {
  return Blockly.serialization.blocks.append(
    { type, fields: { VAR: { id: x.getId() } } },
    workspace,
  )
}

function fieldOf(block: Blockly.Block): KumiteFieldVariable {
  const field = block.getField('VAR')
  if (!(field instanceof KumiteFieldVariable)) throw new Error('VAR is not a KumiteFieldVariable')
  return field
}

/** What the dropdown does when the participant picks an item: `value` is the
 * item's value, a variable id or one of Blockly's two special ids. */
function pick(block: Blockly.Block, value: string) {
  const menuItem = { getValue: () => value } as unknown as Blockly.MenuItem
  const field = fieldOf(block) as unknown as {
    onItemSelected_(menu: Blockly.Menu, item: Blockly.MenuItem): void
  }
  field.onItemSelected_({} as Blockly.Menu, menuItem)
}

function variableNames() {
  return workspace
    .getVariableMap()
    .getAllVariables()
    .map((variable) => variable.getName())
}

beforeEach(() => {
  installVariableField()
  workspace = new Blockly.Workspace()
  x = workspace.getVariableMap().createVariable('x', '')
  prompt = vi.fn<typeof Blockly.dialog.prompt>()
  confirm = vi.fn<typeof Blockly.dialog.confirm>()
  Blockly.dialog.setPrompt(prompt)
  Blockly.dialog.setConfirm(confirm)
})

afterEach(() => {
  Blockly.dialog.setPrompt()
  Blockly.dialog.setConfirm()
  workspace.dispose()
})

describe('KumiteFieldVariable (#335)', () => {
  it('is what the registry builds for every field_variable, native blocks included', () => {
    expect(Blockly.registry.getClass(Blockly.registry.Type.FIELD, 'field_variable')).toBe(
      KumiteFieldVariable,
    )
    expect(useOfX('variables_set').getField('VAR')).toBeInstanceOf(KumiteFieldVariable)
  })

  it('installs once, however many times it is called', () => {
    expect(() => {
      installVariableField()
      installVariableField()
    }).not.toThrow()
    expect(useOfX().getField('VAR')).toBeInstanceOf(KumiteFieldVariable)
  })

  it("asks the app to rename, never Blockly's prompt", () => {
    const handler = vi.fn()
    setVariableDialogHandler(workspace, handler)

    pick(useOfX(), Blockly.RENAME_VARIABLE_ID)

    expect(handler).toHaveBeenCalledWith({
      kind: 'rename',
      workspace,
      variableId: x.getId(),
      name: 'x',
    })
    expect(prompt).not.toHaveBeenCalled()
  })

  it("asks the app to confirm deleting a variable in use, never Blockly's confirm", () => {
    const handler = vi.fn()
    setVariableDialogHandler(workspace, handler)
    const clicked = useOfX()
    useOfX('variables_set')

    pick(clicked, Blockly.DELETE_VARIABLE_ID)

    // The total counts every block that goes, the clicked one included.
    expect(handler).toHaveBeenCalledWith({
      kind: 'delete',
      workspace,
      variableId: x.getId(),
      name: 'x',
      uses: 2,
    })
    expect(variableNames()).toEqual(['x'])
    expect(workspace.getAllBlocks(false)).toHaveLength(2)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('deletes at once when the clicked block is the only use, as Blockly does', () => {
    const handler = vi.fn()
    setVariableDialogHandler(workspace, handler)

    pick(useOfX(), Blockly.DELETE_VARIABLE_ID)

    expect(handler).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(variableNames()).toEqual([])
    expect(workspace.getAllBlocks(false)).toHaveLength(0)
  })

  it('falls back to Blockly on a workspace with no handler', () => {
    const clicked = useOfX()
    useOfX()

    pick(clicked, Blockly.DELETE_VARIABLE_ID)
    pick(clicked, Blockly.RENAME_VARIABLE_ID)

    expect(confirm).toHaveBeenCalledOnce()
    expect(prompt).toHaveBeenCalledOnce()
  })

  it('still switches to another variable when one is picked', () => {
    const handler = vi.fn()
    setVariableDialogHandler(workspace, handler)
    const y = workspace.getVariableMap().createVariable('y', '')
    const block = useOfX()

    pick(block, y.getId())

    expect(block.getFieldValue('VAR')).toBe(y.getId())
    expect(handler).not.toHaveBeenCalled()
  })

  it('leaves a block that is being disposed to Blockly', () => {
    const handler = vi.fn()
    setVariableDialogHandler(workspace, handler)
    const block = useOfX()
    vi.spyOn(block, 'isDeadOrDying').mockReturnValue(true)

    pick(block, Blockly.RENAME_VARIABLE_ID)

    expect(handler).not.toHaveBeenCalled()
  })
})
