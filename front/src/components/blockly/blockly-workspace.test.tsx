import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
  type BlocklyWorkspaceProps,
  type WorkspaceState,
} from './blockly-workspace'
import { demoToolbox } from './demo-toolbox'

const fixture: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } }],
  },
}

// Blockly batches its events and flushes them on a macrotask, so nothing the
// change listener does is observable in the same tick.
function flushBlocklyEvents() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function renderWorkspace(props: Partial<BlocklyWorkspaceProps> = {}) {
  const ref = createRef<BlocklyWorkspaceHandle>()
  const utils = render(<BlocklyWorkspace ref={ref} toolbox={demoToolbox} {...props} />)
  const handle = ref.current
  if (!handle) throw new Error('the imperative handle was not attached')
  return { handle, ...utils }
}

afterEach(cleanup)

describe('BlocklyWorkspace', () => {
  it('renders the workspace with the toolbox it got by prop', () => {
    renderWorkspace()

    expect(screen.getByTestId('blockly-workspace').querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Lógica')).toBeDefined()
    expect(screen.getByText('Números')).toBeDefined()
  })

  it('injects a single workspace even when StrictMode mounts it twice', () => {
    render(
      <StrictMode>
        <BlocklyWorkspace toolbox={demoToolbox} />
      </StrictMode>,
    )

    expect(screen.getByTestId('blockly-workspace').querySelectorAll('svg.blocklySvg')).toHaveLength(
      1,
    )
  })

  it('round-trips the workspace through serialize and deserialize', () => {
    const source = renderWorkspace()
    source.handle.deserialize(fixture)
    const saved = source.handle.serialize()
    source.unmount()

    const target = renderWorkspace()
    target.handle.deserialize(saved)

    expect(target.handle.serialize()).toEqual(saved)
  })

  it('empties the workspace on clear()', () => {
    const { handle } = renderWorkspace({ initialState: fixture })

    handle.clear()

    expect(handle.serialize().blocks?.blocks).toBeUndefined()
  })

  it('fires onChange with the current serialization when the blocks change', async () => {
    const onChange = vi.fn()
    const { handle } = renderWorkspace({ onChange })

    handle.deserialize(fixture)

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.lastCall?.[0]).toEqual(handle.serialize())
    expect(onChange.mock.lastCall?.[0].blocks.blocks[0].type).toBe('math_number')
  })

  it('does not fire onChange for UI-only events', async () => {
    const onChange = vi.fn()
    const { handle } = renderWorkspace({ onChange })
    handle.deserialize(fixture)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    onChange.mockClear()

    handle.getWorkspace()?.getBlockById('fixtureNum')?.select()
    await flushBlocklyEvents()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies initialState on mount without reporting it as a change', async () => {
    const onChange = vi.fn()
    const { handle } = renderWorkspace({ initialState: fixture, onChange })

    expect(handle.serialize().blocks.blocks[0].type).toBe('math_number')
    await flushBlocklyEvents()
    expect(onChange).not.toHaveBeenCalled()
  })
})
