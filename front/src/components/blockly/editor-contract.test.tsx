import {
  emptyWorkspaceState,
  generateSolution,
  ROOT_BLOCK_TYPE,
  somaDosPares,
} from '@kumite/blocks'
import { cleanup, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'
import { toolbox, workspaceOptions } from '@/lib/blockly-setup'
import { BlocklyWorkspace, type BlocklyWorkspaceHandle } from './blockly-workspace'

/**
 * The editor's end of the #4 contract, mounted with the same toolbox and
 * options the problem screen uses: what the participant sees must serialize
 * into something `generateSolution` turns into a runnable `solve(input)`.
 * #16 proved that headless, from a fixture — this proves it from a live
 * workspace, which is what the Executar button (#5) will hand to the judge.
 */
function renderEditor(initialState = emptyWorkspaceState) {
  const ref = createRef<BlocklyWorkspaceHandle>()
  const utils = render(
    <BlocklyWorkspace
      ref={ref}
      toolbox={toolbox}
      options={workspaceOptions}
      initialState={initialState}
    />,
  )
  const handle = ref.current
  if (!handle) throw new Error('the imperative handle was not attached')
  return { handle, ...utils }
}

afterEach(cleanup)

describe('the editor contract', () => {
  it('mounts the root block protected from deletion', () => {
    const { handle } = renderEditor()
    const workspace = handle.getWorkspace()
    if (!workspace) throw new Error('the workspace was not injected')

    const roots = workspace.getBlocksByType(ROOT_BLOCK_TYPE, false)

    expect(roots).toHaveLength(1)
    expect(roots[0]?.isOwnDeletable()).toBe(false)
    expect(roots[0]?.isDeletable()).toBe(false)
    // Still movable: the participant may drag it around, just not throw it away.
    expect(roots[0]?.isMovable()).toBe(true)
  })

  it('generates a runnable solve(input) from what the workspace holds', () => {
    const { handle } = renderEditor()

    handle.deserialize(somaDosPares)
    const code = generateSolution(handle.serialize())
    const solve = new Function(`${code}\nreturn solve`)() as (input: number[]) => number

    expect(solve([1, 2, 3, 4])).toBe(6)
    expect(solve([])).toBe(0)
    expect(solve([1, 3, 5])).toBe(0)
  })
})
