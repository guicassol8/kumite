import * as Blockly from 'blockly'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export type WorkspaceState = ReturnType<typeof Blockly.serialization.workspaces.save>

export type BlocklyWorkspaceHandle = {
  serialize(): WorkspaceState
  deserialize(state: WorkspaceState): void
  clear(): void
  /**
   * Centers the view on the content, keeping the zoom and every block where
   * it is (#205). A viewport change only — never reported through onChange.
   */
  recenter(): void
  /** Escape hatch for the tasks that drive Blockly directly (root block, codegen). */
  getWorkspace(): Blockly.WorkspaceSvg | null
}

export type BlocklyWorkspaceProps = {
  toolbox: Blockly.utils.toolbox.ToolboxDefinition
  initialState?: WorkspaceState
  onChange?: (state: WorkspaceState) => void
  options?: Partial<Blockly.BlocklyOptions>
  className?: string
  /**
   * Fires once, synchronously within the injection effect, with the actual
   * surviving workspace instance. In dev, React StrictMode mounts this
   * component's effects twice (inject → dispose → inject again) as part of
   * the very same commit; a caller that instead waits for its own separate
   * effect to observe the ref can run between those two injections and end
   * up wiring the disposed instance. Use this for anything that must attach
   * to the exact workspace Blockly is keeping.
   */
  onReady?: (workspace: Blockly.WorkspaceSvg) => void
}

const defaultOptions: Partial<Blockly.BlocklyOptions> = {
  // Blockly's own default is https://static.blockly.com/media/, which would put
  // the editor's sprites, cursors and sounds behind a third-party CDN on the
  // one screen the whole event runs on. `public/blockly-media/` is the copy
  // that ships inside the package — blockly-media.test.ts fails if the two
  // drift apart on an upgrade.
  media: '/blockly-media/',
  renderer: 'zelos',
  trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 0.9, minScale: 0.4, maxScale: 2 },
  grid: { spacing: 20, length: 3, snap: true },
  move: { scrollbars: true, drag: true, wheel: true },
}

/**
 * Hosts a Blockly workspace and nothing else: no toolbox curation, no problem
 * logic, no persistence. The toolbox arrives by prop and the workspace is
 * driven through the imperative handle.
 */
export const BlocklyWorkspace = forwardRef<BlocklyWorkspaceHandle, BlocklyWorkspaceProps>(
  function BlocklyWorkspace({ toolbox, initialState, onChange, options, className, onReady }, ref) {
    const { t } = useTranslation()
    const containerRef = useRef<HTMLDivElement>(null)
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
    const appliedToolboxRef = useRef(toolbox)

    // The workspace is injected once, so the injection effect reads the props
    // from here instead of depending on them.
    const propsRef = useRef({ toolbox, initialState, onChange, options, onReady })
    propsRef.current = { toolbox, initialState, onChange, options, onReady }

    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const { toolbox: injected, initialState: restored, options: overrides } = propsRef.current

      const workspace = Blockly.inject(container, {
        ...defaultOptions,
        ...overrides,
        toolbox: injected,
      })
      workspaceRef.current = workspace
      appliedToolboxRef.current = injected
      propsRef.current.onReady?.(workspace)

      // Restoring a saved workspace is not a user edit: suppress the events
      // altogether, then start listening.
      if (restored) {
        Blockly.Events.disable()
        try {
          Blockly.serialization.workspaces.load(restored, workspace)
        } finally {
          Blockly.Events.enable()
        }
      }

      const listener = (event: Blockly.Events.Abstract) => {
        if (event.isUiEvent) return
        if (event.type === Blockly.Events.VIEWPORT_CHANGE) return
        if (workspace.isDragging()) return
        propsRef.current.onChange?.(Blockly.serialization.workspaces.save(workspace))
      }
      workspace.addChangeListener(listener)

      // The window may never change size while the container does (the editor
      // layout collapsing on mobile, a panel opening) — observe the box, not
      // the viewport, or Blockly keeps its stale size and clips blocks.
      //
      // #205: the first time the box has a real size, center the *view* on
      // the content (the seeded root, or the restored autosave) — never move
      // the blocks. Not at injection: the container can still be 0x0 there
      // (stacked mobile column, panels measuring themselves). Later resizes
      // leave the view alone, the participant may have scrolled on purpose.
      // The flag lives in this effect, so each mount starts over.
      let centered = false
      const observer = new ResizeObserver((entries) => {
        Blockly.svgResize(workspace)
        if (centered) return
        const box = entries[entries.length - 1]?.contentRect
        if (!box || box.width <= 0 || box.height <= 0) return
        centered = true
        workspace.scrollCenter()
      })
      observer.observe(container)

      return () => {
        observer.disconnect()
        workspace.removeChangeListener(listener)
        workspace.dispose()
        workspaceRef.current = null
      }
    }, [])

    // A new toolbox swaps in place — the blocks already on the canvas stay.
    useEffect(() => {
      const workspace = workspaceRef.current
      if (!workspace || appliedToolboxRef.current === toolbox) return
      appliedToolboxRef.current = toolbox
      workspace.updateToolbox(toolbox)
    }, [toolbox])

    useImperativeHandle(
      ref,
      () => ({
        serialize: () => {
          const workspace = workspaceRef.current
          return workspace ? Blockly.serialization.workspaces.save(workspace) : {}
        },
        deserialize: (state: WorkspaceState) => {
          const workspace = workspaceRef.current
          if (workspace) Blockly.serialization.workspaces.load(state, workspace)
        },
        clear: () => {
          workspaceRef.current?.clear()
        },
        recenter: () => {
          workspaceRef.current?.scrollCenter()
        },
        getWorkspace: () => workspaceRef.current,
      }),
      [],
    )

    return (
      <div
        ref={containerRef}
        aria-label={t('editor.workspaceLabel')}
        data-testid="blockly-workspace"
        className={cn('h-full w-full', className)}
      />
    )
  },
)
