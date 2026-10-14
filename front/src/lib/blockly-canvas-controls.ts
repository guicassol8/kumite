import * as Blockly from 'blockly'

export const CANVAS_CONTROL_IDS = {
  recenter: 'kumiteRecenterControl',
  zoomOut: 'kumiteZoomOutControl',
  zoomIn: 'kumiteZoomInControl',
} as const

export type CanvasControlLabels = { zoomIn: string; zoomOut: string; recenter: string }

export type CanvasControls = {
  setLabels(labels: CanvasControlLabels): void
  dispose(): void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
// A 32px circle, 20px clear of the trashcan and of the view's edges (as
// Blockly's own controls), 8px between one circle and the next (#340, as in
// the identity's boards).
const SIZE = 32
const MARGIN = 20
const GAP = 8
// More columns than controls is never needed: each control finds a place in
// one of them, or none fits and it stays in the first.
const MAX_COLUMNS = 4

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  parent?.appendChild(element)
  return element
}

export type CanvasControlConfig = {
  id: string
  testId: string
  /** Blockly places positionables by ascending weight, each clear of the ones before. */
  weight: number
  /** Distance kept from whatever was placed below it in its column. */
  gap: number
  /**
   * The control it stacks on: it never takes a column before that one's, so
   * a pair (zoom out, zoom in) moving to the next column moves together.
   */
  follows?: CanvasControl
  /** Room the column must still have past it, for the controls that follow it. */
  reserve?: number
  /** Draws the icon into a 32×32 group already stroked with the icon color. */
  icon(group: SVGGElement): void
  action(workspace: Blockly.WorkspaceSvg): void
}

/**
 * One round button of the editor's canvas (#205, #340): a Blockly
 * positionable component, so Blockly itself stacks it in the corner opposite
 * the toolbox, above the trashcan, and keeps it there on every resize.
 *
 * Drawn by hand inside the workspace svg, since React icons cannot live
 * there; colors come from the app's tokens via Tailwind classes, so a theme
 * switch repaints it without touching Blockly.
 */
export class CanvasControl implements Blockly.IPositionable {
  readonly id: string
  private readonly group: SVGGElement
  private readonly title: SVGTitleElement
  private top = 0
  private left = 0
  private disposed = false

  constructor(
    private readonly workspace: Blockly.WorkspaceSvg,
    private readonly config: CanvasControlConfig,
    label: string,
  ) {
    this.id = config.id
    this.group = svg('g', {
      role: 'button',
      tabindex: '0',
      'data-testid': config.testId,
      class:
        'group cursor-pointer outline-none [&:focus-visible>circle]:stroke-ring [&:focus-visible>circle]:stroke-2',
    })
    this.title = svg('title', {}, this.group)
    const half = String(SIZE / 2)
    svg('circle', { cx: half, cy: half, r: half, class: 'fill-card stroke-border' }, this.group)
    const icon = svg(
      'g',
      {
        fill: 'none',
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
        class: 'stroke-muted-foreground group-hover:stroke-foreground',
      },
      this.group,
    )
    config.icon(icon)
    this.setLabel(label)

    // Keep the press away from the workspace's own gesture (a drag of the
    // canvas), as Blockly's controls do.
    this.group.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.preventDefault()
    })
    this.group.addEventListener('click', (event) => {
      event.stopPropagation()
      this.run()
    })
    this.group.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      this.run()
    })

    workspace.getSvgGroup().appendChild(this.group)
    workspace.getComponentManager().addComponent({
      component: this,
      weight: config.weight,
      capabilities: [Blockly.ComponentManager.Capability.POSITIONABLE],
    })
  }

  setLabel(label: string): void {
    this.group.setAttribute('aria-label', label)
    this.title.textContent = label
  }

  run(): void {
    this.config.action(this.workspace)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.workspace.getComponentManager().removeComponent(this.id)
    this.group.remove()
  }

  getBoundingRectangle(): Blockly.utils.Rect {
    return new Blockly.utils.Rect(this.top, this.top + SIZE, this.left, this.left + SIZE)
  }

  position(metrics: Blockly.MetricsManager.UiMetrics, savedPositions: Blockly.utils.Rect[]): void {
    const corner = Blockly.uiPosition.getCornerOppositeToolbox(this.workspace, metrics)
    const start = Blockly.uiPosition.getStartPositionRect(
      corner,
      new Blockly.utils.Size(SIZE, SIZE),
      MARGIN,
      MARGIN,
      metrics,
      this.workspace,
    )
    const direction =
      corner.vertical === Blockly.uiPosition.verticalPosition.TOP
        ? Blockly.uiPosition.bumpDirection.DOWN
        : Blockly.uiPosition.bumpDirection.UP
    const viewTop = metrics.absoluteMetrics.top
    const viewBottom = viewTop + metrics.viewMetrics.height
    const reserve = this.config.reserve ?? 0
    const up = direction === Blockly.uiPosition.bumpDirection.UP
    const fits = (rect: Blockly.utils.Rect) =>
      rect.top - (up ? reserve : 0) >= viewTop + MARGIN &&
      rect.bottom + (up ? 0 : reserve) <= viewBottom - MARGIN

    // A short editor (the stacked phone layout) has no room for the whole
    // column: stacking on would push a control out of the view. What does
    // not fit goes to the next column, in the same corner, stacking from the
    // bottom again (#205, #340).
    const below = this.config.follows?.getBoundingRectangle()
    let column = below
      ? new Blockly.utils.Rect(start.top, start.bottom, below.left, below.right)
      : start
    const first = Blockly.uiPosition.bumpPositionRect(
      column,
      this.config.gap,
      direction,
      savedPositions,
    )
    let placed = first
    for (let tries = 1; !fits(placed) && tries < MAX_COLUMNS; tries++) {
      const inColumn = savedPositions.filter(
        (rect) => rect.right > column.left && rect.left < column.right,
      )
      const edge =
        corner.horizontal === Blockly.uiPosition.horizontalPosition.RIGHT
          ? Math.min(column.left, ...inColumn.map((rect) => rect.left)) - MARGIN - SIZE
          : Math.max(column.right, ...inColumn.map((rect) => rect.right)) + MARGIN
      column = new Blockly.utils.Rect(start.top, start.bottom, edge, edge + SIZE)
      placed = Blockly.uiPosition.bumpPositionRect(
        column,
        this.config.gap,
        direction,
        savedPositions,
      )
    }
    if (!fits(placed)) placed = first

    this.top = placed.top
    this.left = placed.left
    this.group.setAttribute('transform', `translate(${this.left},${this.top})`)
  }
}

const TRASHCAN_WEIGHT = Blockly.ComponentManager.ComponentWeight.TRASHCAN_WEIGHT

/**
 * The editor's three canvas controls (#340), bottom to top above the
 * trashcan: recenter (#205: scrolls to the content, keeping the zoom), zoom
 * out, zoom in. They replace Blockly's sprite zoom controls (inject with
 * `zoom.controls: false`); `zoomCenter` stays within `minScale`/`maxScale`
 * and only fires a viewport change.
 */
export function createCanvasControls(
  workspace: Blockly.WorkspaceSvg,
  labels: CanvasControlLabels,
): CanvasControls {
  const recenter = new CanvasControl(
    workspace,
    {
      id: CANVAS_CONTROL_IDS.recenter,
      testId: 'editor-recenter',
      weight: TRASHCAN_WEIGHT + 1,
      gap: MARGIN,
      icon: (group) => {
        svg('circle', { cx: '16', cy: '16', r: '6' }, group)
        svg('circle', { cx: '16', cy: '16', r: '1.25', class: 'fill-current' }, group)
        for (const d of ['M16 6v4', 'M16 22v4', 'M6 16h4', 'M22 16h4']) svg('path', { d }, group)
      },
      action: (target) => target.scrollCenter(),
    },
    labels.recenter,
  )
  const zoomOut = new CanvasControl(
    workspace,
    {
      id: CANVAS_CONTROL_IDS.zoomOut,
      testId: 'editor-zoom-out',
      weight: TRASHCAN_WEIGHT + 2,
      gap: GAP,
      follows: recenter,
      // Zoom in goes right above it: the pair changes column together.
      reserve: GAP + SIZE,
      icon: (group) => {
        svg('path', { d: 'M10 16h12' }, group)
      },
      action: (target) => target.zoomCenter(-1),
    },
    labels.zoomOut,
  )
  const zoomIn = new CanvasControl(
    workspace,
    {
      id: CANVAS_CONTROL_IDS.zoomIn,
      testId: 'editor-zoom-in',
      weight: TRASHCAN_WEIGHT + 3,
      gap: GAP,
      follows: zoomOut,
      icon: (group) => {
        svg('path', { d: 'M10 16h12' }, group)
        svg('path', { d: 'M16 10v12' }, group)
      },
      action: (target) => target.zoomCenter(1),
    },
    labels.zoomIn,
  )
  // Place them now instead of on the next resize.
  workspace.resize()

  return {
    setLabels: (next) => {
      recenter.setLabel(next.recenter)
      zoomOut.setLabel(next.zoomOut)
      zoomIn.setLabel(next.zoomIn)
    },
    dispose: () => {
      for (const control of [zoomIn, zoomOut, recenter]) control.dispose()
    },
  }
}
