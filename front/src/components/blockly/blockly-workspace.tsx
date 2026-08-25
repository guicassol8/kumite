import * as Blockly from 'blockly'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { cn } from '@/lib/utils'

export type WorkspaceState = ReturnType<typeof Blockly.serialization.workspaces.save>

export type BlocklyWorkspaceHandle = {
  serialize(): WorkspaceState
  deserialize(state: WorkspaceState): void
  clear(): void
  /** Escape hatch for the tasks that drive Blockly directly (root block, codegen). */
  getWorkspace(): Blockly.WorkspaceSvg | null
}

export type BlocklyWorkspaceProps = {
  toolbox: Blockly.utils.toolbox.ToolboxDefinition
  initialState?: WorkspaceState
  onChange?: (state: WorkspaceState) => void
  options?: Partial<Blockly.BlocklyOptions>
  className?: string
}

const defaultOptions: Partial<Blockly.BlocklyOptions> = {
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
  function BlocklyWorkspace({ toolbox, initialState, onChange, options, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
    const appliedToolboxRef = useRef(toolbox)

    // The workspace is injected once, so the injection effect reads the props
    // from here instead of depending on them.
    const propsRef = useRef({ toolbox, initialState, onChange, options })
    propsRef.current = { toolbox, initialState, onChange, options }

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

      return () => {
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
        getWorkspace: () => workspaceRef.current,
      }),
      [],
    )

    return (
      <div
        ref={containerRef}
        data-testid="blockly-workspace"
        className={cn('h-full w-full', className)}
      />
    )
  },
)
