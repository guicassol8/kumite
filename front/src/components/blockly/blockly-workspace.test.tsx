import { buildToolbox, defineKumiteBlocks } from '@kumite/blocks'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import * as Blockly from 'blockly'
import { createRef, StrictMode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
  type BlocklyWorkspaceProps,
  type WorkspaceState,
} from './blockly-workspace'

// The wrapper is toolbox-agnostic, but driving it with the real curated toolbox
// is also the front's smoke test that @kumite/blocks loads under Vite.
const toolbox = buildToolbox('pt')

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

// Stands in for the jsdom shim when a test needs to drive a resize by hand.
// Blockly builds observers of its own, hence the per-instance target list.
class RecordingResizeObserver {
  static instances: RecordingResizeObserver[] = []
  readonly targets: Element[] = []
  readonly disconnect = vi.fn()
  readonly unobserve = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    RecordingResizeObserver.instances.push(this)
  }

  observe(target: Element) {
    this.targets.push(target)
  }
}

function renderWorkspace(props: Partial<BlocklyWorkspaceProps> = {}) {
  const ref = createRef<BlocklyWorkspaceHandle>()
  const utils = render(<BlocklyWorkspace ref={ref} toolbox={toolbox} {...props} />)
  const handle = ref.current
  if (!handle) throw new Error('the imperative handle was not attached')
  return { handle, ...utils }
}

beforeAll(() => {
  defineKumiteBlocks('pt')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BlocklyWorkspace', () => {
  it('renders the workspace with the toolbox it got by prop', () => {
    renderWorkspace()

    expect(screen.getByTestId('blockly-workspace').querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Lógica')).toBeDefined()
    expect(screen.getByText('Matemática')).toBeDefined()
  })

  it('serves its media from the app itself, never a third-party CDN', () => {
    let pathToMedia: string | undefined
    renderWorkspace({
      onReady: (workspace) => {
        pathToMedia = workspace.options.pathToMedia
      },
    })

    expect(pathToMedia).toBe('/blockly-media/')
  })

  it('labels the workspace for screen readers', () => {
    renderWorkspace()

    expect(screen.getByLabelText('Área de blocos')).toBe(screen.getByTestId('blockly-workspace'))
  })

  it('injects a single workspace even when StrictMode mounts it twice', () => {
    render(
      <StrictMode>
        <BlocklyWorkspace toolbox={toolbox} />
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

  it('resizes the workspace when its container changes size', () => {
    RecordingResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', RecordingResizeObserver)

    const { handle } = renderWorkspace()
    const host = screen.getByTestId('blockly-workspace')
    const observer = RecordingResizeObserver.instances.find((it) => it.targets.includes(host))
    if (!observer) throw new Error('the container is not observed for resizes')
    const workspace = handle.getWorkspace()
    if (!workspace) throw new Error('the workspace was not injected')
    // `Blockly.svgResize` re-measures the parent svg and then resizes the
    // workspace — the call below is what proves the observer is wired to it.
    const resize = vi.spyOn(workspace, 'resize')

    observer.callback([], observer as unknown as ResizeObserver)

    expect(resize).toHaveBeenCalled()

    cleanup()
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('adds a recenter control, relabelled when the language changes (#205)', async () => {
    renderWorkspace()
    const control = screen.getByTestId('editor-recenter')

    expect(control.getAttribute('aria-label')).toBe('Centralizar a solução')

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(control.getAttribute('aria-label')).toBe('Center the solution')
    await act(async () => {
      await i18n.changeLanguage('pt')
    })
  })

  describe('centering the view (#205)', () => {
    function resizeEntry(width: number, height: number) {
      return [{ contentRect: { width, height } }] as unknown as ResizeObserverEntry[]
    }

    function setup() {
      RecordingResizeObserver.instances = []
      vi.stubGlobal('ResizeObserver', RecordingResizeObserver)
      const scrollCenter = vi.spyOn(Blockly.WorkspaceSvg.prototype, 'scrollCenter')
      const onChange = vi.fn()
      const { handle } = renderWorkspace({ initialState: fixture, onChange })
      const host = screen.getByTestId('blockly-workspace')
      const observer = RecordingResizeObserver.instances.find((it) => it.targets.includes(host))
      if (!observer) throw new Error('the container is not observed for resizes')
      const resize = (width: number, height: number) =>
        observer.callback(resizeEntry(width, height), observer as unknown as ResizeObserver)
      return { handle, scrollCenter, onChange, resize }
    }

    it('does not center while the container has no size yet', () => {
      const { scrollCenter, resize } = setup()

      resize(0, 0)

      expect(scrollCenter).not.toHaveBeenCalled()
    })

    it('centers once, on the first resize with a real box, and not on later resizes', () => {
      const { scrollCenter, resize } = setup()

      resize(0, 0)
      resize(800, 600)
      expect(scrollCenter).toHaveBeenCalledOnce()

      resize(640, 600)
      expect(scrollCenter).toHaveBeenCalledOnce()
    })

    it('recenters on demand through the handle', () => {
      const { handle, scrollCenter, resize } = setup()
      resize(800, 600)

      handle.recenter()

      expect(scrollCenter).toHaveBeenCalledTimes(2)
    })

    it('never reports centering as a change nor moves the blocks', async () => {
      const { handle, onChange, resize } = setup()
      const before = handle.serialize()

      resize(800, 600)
      handle.recenter()
      await flushBlocklyEvents()

      expect(onChange).not.toHaveBeenCalled()
      expect(handle.serialize()).toEqual(before)
    })
  })

  it('applies initialState on mount without reporting it as a change', async () => {
    const onChange = vi.fn()
    const { handle } = renderWorkspace({ initialState: fixture, onChange })

    expect(handle.serialize().blocks.blocks[0].type).toBe('math_number')
    await flushBlocklyEvents()
    expect(onChange).not.toHaveBeenCalled()
  })
})
