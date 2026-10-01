import {
  buildToolbox,
  defineKumiteBlocks,
  KUMITE_CATEGORY_BAR_PX,
  kumiteGridOptions,
  kumiteTheme,
  kumiteThemeDark,
} from '@kumite/blocks'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as Blockly from 'blockly'
import { createRef, StrictMode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DESKTOP_QUERY } from '@/hooks/use-media-query'
import i18n from '@/i18n'
import { setMatchMediaMatches } from '@/test/match-media-jsdom'
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

  it("scopes Blockly's z-indexes to its own stacking context, under the app's dialogs (#205)", () => {
    renderWorkspace()

    expect(screen.getByTestId('blockly-workspace').classList).toContain('isolate')
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

// #199: on a phone the open flyout covers the canvas, and every way to put it
// away was implicit (the category again, the bare toolbox, Esc, the covered
// canvas). Below md an explicit "Fechar" sits over the editor while it is
// open. The geometry — on screen, inside the editor, 44px — is
// e2e/problem-mobile.spec.ts's.
describe('the flyout close button (#199)', () => {
  // Blockly fires its queue from a requestAnimationFrame and then a
  // setTimeout (`core/events/utils.ts`), so a bare setTimeout flush returns
  // before the toolbox event lands. Registered after Blockly's own, these
  // run after it.
  function flushToolboxEvents() {
    return act(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))),
    )
  }

  afterEach(() => {
    setMatchMediaMatches(DESKTOP_QUERY, false)
  })

  function toolboxOf(handle: BlocklyWorkspaceHandle) {
    const toolbox = handle.getWorkspace()?.getToolbox()
    if (!toolbox) throw new Error('expected a toolbox')
    return toolbox as Blockly.Toolbox
  }

  async function openCategory(handle: BlocklyWorkspaceHandle, position: number) {
    act(() => {
      toolboxOf(handle).selectItemByPosition(position)
    })
    await flushToolboxEvents()
  }

  it('shows while a category is open below md, and closes the flyout on a click', async () => {
    const onChange = vi.fn()
    const { handle } = renderWorkspace({ onChange })
    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()

    await openCategory(handle, 0)
    expect(handle.getWorkspace()?.getFlyout()?.isVisible()).toBe(true)
    const close = screen.getByTestId('editor-flyout-close')
    expect(close.getAttribute('aria-label')).toBe('Fechar a lista de blocos')
    expect(close.textContent).toBe('Fechar')

    fireEvent.click(close)
    await flushToolboxEvents()

    expect(handle.getWorkspace()?.getFlyout()?.isVisible()).toBe(false)
    expect(toolboxOf(handle).getSelectedItem()).toBeNull()
    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()
    // Opening and closing the box of blocks is not an edit.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hands the focus to the canvas instead of dropping it on <body>', async () => {
    const { handle } = renderWorkspace()
    await openCategory(handle, 0)
    const close = screen.getByTestId('editor-flyout-close')
    // A browser focuses the button it activates; the button then unmounts.
    close.focus()

    fireEvent.click(close)
    await flushToolboxEvents()

    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()
    // Where a tap on the canvas leaves it: the workspace itself, not a block.
    expect(Blockly.getFocusManager().getFocusedNode()).toBe(handle.getWorkspace())
    expect(screen.getByTestId('blockly-workspace').contains(document.activeElement)).toBe(true)
  })

  it('keeps the focus on the canvas when a press on the button closes the flyout first', async () => {
    const { handle } = renderWorkspace()
    await openCategory(handle, 0)
    const category = toolboxOf(handle).getSelectedItem()
    if (!category) throw new Error('expected an open category')
    // Where a tap on the category leaves the focus.
    act(() => {
      Blockly.getFocusManager().focusNode(category as unknown as Blockly.IFocusableNode)
    })
    const close = screen.getByTestId('editor-flyout-close')

    // A held mouse press: the button takes the focus on mousedown, Blockly's
    // FocusManager blurs the toolbox, which closes the flyout and unmounts
    // the button before any click reaches it.
    act(() => {
      close.focus()
    })
    await flushToolboxEvents()

    expect(handle.getWorkspace()?.getFlyout()?.isVisible()).toBe(false)
    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()
    expect(Blockly.getFocusManager().getFocusedNode()).toBe(handle.getWorkspace())
    expect(screen.getByTestId('blockly-workspace').contains(document.activeElement)).toBe(true)
  })

  it('leaves the focus alone when the flyout closes because it went elsewhere', async () => {
    const { handle } = renderWorkspace()
    const outside = document.createElement('button')
    document.body.append(outside)
    try {
      await openCategory(handle, 0)
      const category = toolboxOf(handle).getSelectedItem()
      if (!category) throw new Error('expected an open category')
      act(() => {
        Blockly.getFocusManager().focusNode(category as unknown as Blockly.IFocusableNode)
      })

      // Tab or a tap on another control: the toolbox blurs and the flyout
      // closes — the focus belongs where the participant put it.
      act(() => {
        outside.focus()
      })
      await flushToolboxEvents()

      expect(handle.getWorkspace()?.getFlyout()?.isVisible()).toBe(false)
      expect(document.activeElement).toBe(outside)
    } finally {
      outside.remove()
    }
  })

  it('follows the flyout when it is closed the implicit way', async () => {
    const { handle } = renderWorkspace()
    await openCategory(handle, 0)
    expect(screen.getByTestId('editor-flyout-close')).not.toBeNull()

    // The same category again is Blockly's own toggle.
    await openCategory(handle, 0)

    expect(handle.getWorkspace()?.getFlyout()?.isVisible()).toBe(false)
    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()
  })

  it('stays out of the way on md+', async () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)
    const { handle } = renderWorkspace()

    await openCategory(handle, 0)

    expect(handle.getWorkspace()?.getFlyout()?.isVisible()).toBe(true)
    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()
  })

  it('never shows on a canvas without a toolbox', async () => {
    renderWorkspace({ toolbox: undefined, options: { readOnly: true } })
    await flushToolboxEvents()

    expect(screen.queryByTestId('editor-flyout-close')).toBeNull()
  })

  it('relabels with the language', async () => {
    const { handle } = renderWorkspace()
    await openCategory(handle, 0)

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    const close = screen.getByTestId('editor-flyout-close')
    expect(close.getAttribute('aria-label')).toBe('Close the block list')
    expect(close.textContent).toBe('Close')
    await act(async () => {
      await i18n.changeLanguage('pt')
    })
  })
})

describe('BlocklyWorkspace theme (#218)', () => {
  it('injects with the theme it got by prop', () => {
    const { handle } = renderWorkspace({ theme: kumiteTheme })

    expect(handle.getWorkspace()?.getTheme().name).toBe('kumite')
  })

  it('injects the kumite grid, snap included', () => {
    const { handle } = renderWorkspace({ theme: kumiteTheme })

    expect(handle.getWorkspace()?.options.gridOptions).toMatchObject(kumiteGridOptions)
  })

  it('narrows the toolbox category bar to the kumite width', () => {
    expect(Blockly.ToolboxCategory.borderWidth).toBe(KUMITE_CATEGORY_BAR_PX)
  })

  it('swaps the theme in place, keeping the same workspace and its blocks', () => {
    const ref = createRef<BlocklyWorkspaceHandle>()
    const { rerender } = render(
      <BlocklyWorkspace ref={ref} toolbox={toolbox} theme={kumiteTheme} initialState={fixture} />,
    )
    const before = ref.current?.getWorkspace()
    const saved = ref.current?.serialize()

    rerender(
      <BlocklyWorkspace
        ref={ref}
        toolbox={toolbox}
        theme={kumiteThemeDark}
        initialState={fixture}
      />,
    )

    const after = ref.current?.getWorkspace()
    expect(after).toBe(before)
    expect(after?.getTheme().name).toBe('kumite-dark')
    expect(ref.current?.serialize()).toEqual(saved)
  })

  it('does not re-apply a theme that did not change', () => {
    const ref = createRef<BlocklyWorkspaceHandle>()
    const { rerender } = render(
      <BlocklyWorkspace ref={ref} toolbox={toolbox} theme={kumiteTheme} />,
    )
    const workspace = ref.current?.getWorkspace()
    if (!workspace) throw new Error('no workspace')
    const setTheme = vi.spyOn(workspace, 'setTheme')

    rerender(<BlocklyWorkspace ref={ref} toolbox={toolbox} theme={kumiteTheme} />)

    expect(setTheme).not.toHaveBeenCalled()
  })

  it('applies the theme to the surviving workspace under StrictMode', () => {
    const ref = createRef<BlocklyWorkspaceHandle>()
    const { rerender } = render(
      <StrictMode>
        <BlocklyWorkspace ref={ref} toolbox={toolbox} theme={kumiteTheme} />
      </StrictMode>,
    )
    expect(ref.current?.getWorkspace()?.getTheme().name).toBe('kumite')

    rerender(
      <StrictMode>
        <BlocklyWorkspace ref={ref} toolbox={toolbox} theme={kumiteThemeDark} />
      </StrictMode>,
    )

    expect(ref.current?.getWorkspace()?.getTheme().name).toBe('kumite-dark')
  })

  // #212: the practice demo's canvas — navigated, never edited.
  describe('read-only', () => {
    it('injects a read-only workspace with no toolbox', () => {
      const ref = createRef<BlocklyWorkspaceHandle>()
      render(<BlocklyWorkspace ref={ref} options={{ readOnly: true }} initialState={fixture} />)
      const workspace = ref.current?.getWorkspace()

      expect(workspace?.isReadOnly()).toBe(true)
      expect(workspace?.getToolbox()).toBeNull()
      expect(workspace?.getBlockById('fixtureNum')).not.toBeNull()
    })

    it('ignores a toolbox swap instead of throwing on the missing toolbox', () => {
      const ref = createRef<BlocklyWorkspaceHandle>()
      const { rerender } = render(
        <BlocklyWorkspace ref={ref} toolbox={toolbox} options={{ readOnly: true }} />,
      )

      expect(() =>
        rerender(
          <BlocklyWorkspace ref={ref} toolbox={buildToolbox('en')} options={{ readOnly: true }} />,
        ),
      ).not.toThrow()
      expect(ref.current?.getWorkspace()?.getToolbox()).toBeNull()
    })

    it('takes its own test id and label, leaving the editor defaults alone', () => {
      render(
        <BlocklyWorkspace
          options={{ readOnly: true }}
          testId="practice-demo-canvas"
          label="Demonstração"
        />,
      )

      const canvas = screen.getByTestId('practice-demo-canvas')
      expect(canvas.getAttribute('aria-label')).toBe('Demonstração')
      expect(screen.queryByTestId('blockly-workspace')).toBeNull()
    })
  })
})

// #367: Blockly ≥ 12 hangs its popups inside the workspace's `.injectionDiv`
// (overflow: hidden) unless told otherwise, but positions them against the
// window — so a menu that fits the window below a block was cut at the
// canvas edge. Where the div lives is what jsdom can prove; the geometry is
// `e2e/blockly-popups-edge.spec.ts`.
describe('Blockly popups live outside the canvas (#367)', () => {
  afterEach(() => {
    Blockly.WidgetDiv.hide()
    Blockly.DropDownDiv.hideWithoutAnimation()
  })

  it('shows the widget div (context menus, inline editors) on <body>', () => {
    const workspace = renderWorkspace().handle.getWorkspace()
    if (!workspace) throw new Error('expected an injected workspace')

    Blockly.WidgetDiv.show({}, false, () => {}, workspace, false)

    const div = Blockly.WidgetDiv.getDiv()
    expect(div?.parentElement).toBe(document.body)
    expect(div?.closest('.injectionDiv')).toBeNull()
  })

  it('shows the dropdown div (field dropdowns) on <body>', () => {
    const workspace = renderWorkspace().handle.getWorkspace()
    if (!workspace) throw new Error('expected an injected workspace')
    const block = workspace.newBlock('logic_compare')
    block.initSvg()
    block.render()
    const field = block.getField('OP')
    if (!field) throw new Error('expected the = dropdown on logic_compare')

    Blockly.DropDownDiv.showPositionedByField(field, undefined, undefined, false)

    const div = Blockly.DropDownDiv.getContentDiv().parentElement
    expect(div?.parentElement).toBe(document.body)
    expect(div?.closest('.injectionDiv')).toBeNull()
  })

  // Blockly 13 still watches the *canvas* for its popovers losing focus
  // (`setMainWorkspace` points the popover focus root at the injectionDiv,
  // parent container or not). With the popovers on <body>, focus moving from
  // the canvas into a dropdown read as the dropdown losing it — it closed as
  // it opened — and focus leaving a popover for the page went unseen.
  describe('focus, with the popovers on <body>', () => {
    let outside: HTMLButtonElement | undefined

    afterEach(() => {
      outside?.remove()
      outside = undefined
    })

    function focusedWorkspace() {
      const workspace = renderWorkspace().handle.getWorkspace()
      if (!workspace) throw new Error('expected an injected workspace')
      workspace.getFocusableElement().focus()
      expect(workspace.getInjectionDiv().contains(document.activeElement)).toBe(true)
      return workspace
    }

    it('keeps a field dropdown open when it takes the focus from the canvas', () => {
      const workspace = focusedWorkspace()
      const block = workspace.newBlock('logic_compare')
      block.initSvg()
      block.render()
      const field = block.getField('OP')
      if (!field) throw new Error('expected the = dropdown on logic_compare')

      Blockly.DropDownDiv.showPositionedByField(field)

      const div = Blockly.DropDownDiv.getContentDiv().parentElement
      expect(div?.contains(document.activeElement)).toBe(true)
      // `hide()` fades out: opacity 0 is the dropdown closing.
      expect(div?.style.opacity).toBe('1')
    })

    it('closes a popover when the focus leaves it for the page', () => {
      const workspace = focusedWorkspace()
      Blockly.WidgetDiv.show({}, false, () => {}, workspace, true)
      expect(Blockly.WidgetDiv.isVisible()).toBe(true)

      outside = document.createElement('button')
      document.body.append(outside)
      outside.focus()

      expect(Blockly.WidgetDiv.isVisible()).toBe(false)
    })

    it('keeps a popover open when the focus goes back to its canvas', () => {
      const workspace = focusedWorkspace()
      Blockly.WidgetDiv.show({}, false, () => {}, workspace, true)

      workspace.getFocusableElement().focus()

      expect(Blockly.WidgetDiv.isVisible()).toBe(true)
    })
  })
})
