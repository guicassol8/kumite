import {
  CREATE_VARIABLE_BUTTON_KEY,
  messagesFor,
  ROOT_BLOCK_TYPE,
  VARIABLES_CATEGORY_KEY,
} from '@kumite/blocks'
import * as Blockly from 'blockly'
import { describe, expect, it, vi } from 'vitest'

import { applyBlocklyLocale, registerVariablesFlyout, workspaceOptions } from '@/lib/blockly-setup'

type Callbacks = {
  registerToolboxCategoryCallback: ReturnType<typeof vi.fn>
  registerButtonCallback: ReturnType<typeof vi.fn>
}

function spyWorkspace(): Callbacks {
  return { registerToolboxCategoryCallback: vi.fn(), registerButtonCallback: vi.fn() }
}

describe('blockly-setup', () => {
  it('translates the native Blockly blocks to pt-br', () => {
    applyBlocklyLocale('pt')

    // These come from the official locale pack, not from @kumite/blocks —
    // without `setLocale` they would still read "repeat %1 times" / "if".
    expect(Blockly.Msg.CONTROLS_REPEAT_TITLE).toBe('repita %1 vezes')
    expect(Blockly.Msg.CONTROLS_IF_MSG_IF).toBe('se')
  })

  it('translates the native Blockly blocks to es', () => {
    applyBlocklyLocale('es')

    expect(Blockly.Msg.CONTROLS_IF_MSG_IF).toBe('si')
  })

  it('translates the native Blockly blocks to en', () => {
    applyBlocklyLocale('en')

    expect(Blockly.Msg.CONTROLS_IF_MSG_IF).toBe('if')
  })

  it('keeps the kumite block labels, which are not Blockly.Msg entries', () => {
    applyBlocklyLocale('pt')
    const workspace = new Blockly.Workspace()
    try {
      const labels = workspace
        .newBlock(ROOT_BLOCK_TYPE)
        .inputList.flatMap((input) => input.fieldRow)
        .map((field) => field.getText())

      expect(labels).toContain(messagesFor('pt').solveTitle)
    } finally {
      workspace.dispose()
    }
  })

  it('returns the curated toolbox for the given locale', () => {
    const toolboxEs = applyBlocklyLocale('es')
    const { contents } = toolboxEs as { contents: { name: string }[] }

    expect(contents.map((category) => category.name)).toEqual([
      'Lógica',
      'Bucles',
      'Matemáticas',
      'Texto',
      'Listas',
      'Variables',
    ])
  })

  it('caps the root block at one instance per workspace', () => {
    expect(workspaceOptions.maxInstances).toEqual({ [ROOT_BLOCK_TYPE]: 1 })
  })

  it('registers the variables flyout and the create-variable button', () => {
    const workspace = spyWorkspace()

    registerVariablesFlyout(workspace as unknown as Blockly.WorkspaceSvg, 'pt', vi.fn())

    expect(workspace.registerToolboxCategoryCallback).toHaveBeenCalledWith(
      VARIABLES_CATEGORY_KEY,
      expect.any(Function),
    )
    expect(workspace.registerButtonCallback).toHaveBeenCalledWith(
      CREATE_VARIABLE_BUTTON_KEY,
      expect.any(Function),
    )
  })

  it("hands the create-variable button to the app's dialog, never to Blockly's prompt (#205)", () => {
    const workspace = spyWorkspace()
    const onCreateVariable = vi.fn()
    const blocklyHandler = vi.spyOn(Blockly.Variables, 'createVariableButtonHandler')
    const blocklyPrompt = vi.spyOn(Blockly.dialog, 'prompt')
    registerVariablesFlyout(workspace as unknown as Blockly.WorkspaceSvg, 'pt', onCreateVariable)
    const callback = workspace.registerButtonCallback.mock.calls[0]?.[1]
    const target = { id: 'target' } as unknown as Blockly.WorkspaceSvg

    callback({ getTargetWorkspace: () => target })

    expect(onCreateVariable).toHaveBeenCalledWith(target)
    expect(blocklyHandler).not.toHaveBeenCalled()
    expect(blocklyPrompt).not.toHaveBeenCalled()
    blocklyHandler.mockRestore()
    blocklyPrompt.mockRestore()
  })

  it('registers a category callback that builds the flyout for the given locale', () => {
    const workspace = spyWorkspace()
    registerVariablesFlyout(workspace as unknown as Blockly.WorkspaceSvg, 'es', vi.fn())
    const callback = workspace.registerToolboxCategoryCallback.mock.calls[0]?.[1]

    const target = new Blockly.Workspace()
    try {
      target.getVariableMap().createVariable('soma')
      const flyout = callback(target) as { text?: string; type?: string }[]

      expect(flyout[0]?.text).toBe(messagesFor('es').categoryVariablesNew)
      expect(flyout.map((item) => item.type)).toContain('variables_get')
    } finally {
      target.dispose()
    }
  })

  it('does nothing when the workspace is not mounted yet', () => {
    expect(() => registerVariablesFlyout(null, 'pt', vi.fn())).not.toThrow()
  })
})
