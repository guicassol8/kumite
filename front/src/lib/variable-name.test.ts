import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validateVariableName } from '@/lib/variable-name'

let workspace: Blockly.Workspace

beforeEach(() => {
  workspace = new Blockly.Workspace()
})

afterEach(() => {
  workspace.dispose()
})

describe('validateVariableName', () => {
  it('refuses an empty name', () => {
    expect(validateVariableName('', workspace)).toEqual({ ok: false, reason: 'empty' })
  })

  it('refuses a name made only of spaces and non-breaking spaces', () => {
    expect(validateVariableName('    \t ', workspace)).toEqual({ ok: false, reason: 'empty' })
  })

  it('refuses a name already used, ignoring case, and names the existing one', () => {
    workspace.getVariableMap().createVariable('soma', '')

    expect(validateVariableName('Soma', workspace)).toEqual({
      ok: false,
      reason: 'duplicate',
      existing: 'soma',
    })
  })

  it('refuses a name already used by a variable of another type', () => {
    workspace.getVariableMap().createVariable('total', 'Number')

    expect(validateVariableName('total', workspace)).toMatchObject({ reason: 'duplicate' })
  })

  it('accepts a new name, normalized the way Blockly normalizes it', () => {
    expect(validateVariableName('  nova    var ', workspace)).toEqual({
      ok: true,
      name: 'nova var',
    })
  })
})
