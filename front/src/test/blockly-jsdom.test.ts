import * as Blockly from 'blockly'
import { afterEach, expect, it } from 'vitest'

// SPIKE (temporary): proves a real Blockly workspace mounts under jsdom with
// the shims in ./blockly-jsdom.ts. Deleted once the component tests cover it.
let container: HTMLDivElement | null = null

afterEach(() => {
  container?.remove()
  container = null
})

it('injects and disposes a real workspace in jsdom', () => {
  container = document.createElement('div')
  document.body.append(container)

  const workspace = Blockly.inject(container, {
    toolbox: {
      kind: 'categoryToolbox',
      contents: [
        { kind: 'category', name: 'Lógica', contents: [{ kind: 'block', type: 'controls_if' }] },
      ],
    },
  })

  expect(container.querySelector('svg')).not.toBeNull()
  expect(() => workspace.dispose()).not.toThrow()
})
