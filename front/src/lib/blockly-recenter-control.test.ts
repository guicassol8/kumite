import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RECENTER_CONTROL_ID, RecenterControl } from '@/lib/blockly-recenter-control'

let host: HTMLDivElement
let workspace: Blockly.WorkspaceSvg
let control: RecenterControl

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  workspace = Blockly.inject(host, {
    media: '/blockly-media/',
    zoom: { controls: true },
    trashcan: true,
  })
  control = new RecenterControl(workspace, 'Centralizar a solução')
})

afterEach(() => {
  control.dispose()
  workspace.dispose()
  host.remove()
  vi.restoreAllMocks()
})

function button(): SVGGElement {
  const element = host.querySelector<SVGGElement>('[data-testid="editor-recenter"]')
  if (!element) throw new Error('the recenter control was not rendered')
  return element
}

describe('RecenterControl', () => {
  it('renders an accessible, labelled button inside the workspace svg', () => {
    expect(button().getAttribute('role')).toBe('button')
    expect(button().getAttribute('tabindex')).toBe('0')
    expect(button().getAttribute('aria-label')).toBe('Centralizar a solução')
    expect(button().querySelector('title')?.textContent).toBe('Centralizar a solução')
  })

  it('registers as a positionable component stacked above the zoom controls', () => {
    const manager = workspace.getComponentManager()

    expect(manager.getComponent(RECENTER_CONTROL_ID)).toBe(control)
    expect(
      manager.hasCapability(RECENTER_CONTROL_ID, Blockly.ComponentManager.Capability.POSITIONABLE),
    ).toBe(true)
    const positionables = manager.getComponents(
      Blockly.ComponentManager.Capability.POSITIONABLE,
      true,
    )
    expect(positionables.at(-1)).toBe(control)
  })

  it('centers the view on click, keeping the zoom', () => {
    const scrollCenter = vi.spyOn(workspace, 'scrollCenter')
    const setScale = vi.spyOn(workspace, 'setScale')

    button().dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(scrollCenter).toHaveBeenCalledOnce()
    expect(setScale).not.toHaveBeenCalled()
  })

  it('centers the view on Enter and Space', () => {
    const scrollCenter = vi.spyOn(workspace, 'scrollCenter')

    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    button().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))

    expect(scrollCenter).toHaveBeenCalledTimes(2)
  })

  it('relabels itself when the language changes', () => {
    control.setLabel('Center the solution')

    expect(button().getAttribute('aria-label')).toBe('Center the solution')
    expect(button().querySelector('title')?.textContent).toBe('Center the solution')
  })

  it('removes itself from the workspace on dispose', () => {
    control.dispose()

    expect(host.querySelector('[data-testid="editor-recenter"]')).toBeNull()
    expect(workspace.getComponentManager().getComponent(RECENTER_CONTROL_ID)).toBeUndefined()
  })
})
