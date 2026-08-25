import type * as Blockly from 'blockly'

// Placeholder toolbox: just enough stock Blockly blocks to exercise the wrapper
// in tests and on /sandbox/editor. The curated kumite toolbox is #4's job
// (@kumite/blocks) — this file goes away with it.
export const demoToolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Lógica',
      categorystyle: 'logic_category',
      contents: [{ kind: 'block', type: 'controls_if' }],
    },
    {
      kind: 'category',
      name: 'Números',
      categorystyle: 'math_category',
      contents: [{ kind: 'block', type: 'math_number' }],
    },
  ],
}
