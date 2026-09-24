import * as Blockly from 'blockly'

export const RECENTER_CONTROL_ID = 'kumiteRecenterControl'

const SVG_NS = 'http://www.w3.org/2000/svg'
// Same box and margins as Blockly's zoom controls, so it reads as one column.
const SIZE = 32
const MARGIN = 20
// Heavier than the zoom controls: Blockly positions components by weight and
// bumps each one clear of the ones already placed, so this lands right above
// the zoom column (the trashcan is 2, zoom 3).
const WEIGHT = Blockly.ComponentManager.ComponentWeight.ZOOM_CONTROLS_WEIGHT + 1

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

/**
 * "Recentrar" button for the editor (#205): a Blockly positionable component,
 * so Blockly itself stacks it with the zoom controls and keeps it clear of the
 * trashcan and the toolbox side. It only scrolls the view to the content
 * (`scrollCenter`) — unlike the native zoom *reset*, it keeps the zoom.
 *
 * Drawn by hand inside the workspace svg (a crosshair), since React icons
 * cannot live there; colors come from the app's tokens via Tailwind classes.
 */
export class RecenterControl implements Blockly.IPositionable {
  readonly id = RECENTER_CONTROL_ID
  private readonly group: SVGGElement
  private readonly title: SVGTitleElement
  private top = 0
  private left = 0
  private disposed = false

  constructor(
    private readonly workspace: Blockly.WorkspaceSvg,
    label: string,
  ) {
    this.group = svg('g', {
      role: 'button',
      tabindex: '0',
      'data-testid': 'editor-recenter',
      class:
        'group cursor-pointer outline-none [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-2',
    })
    this.title = svg('title', {}, this.group)
    svg(
      'rect',
      {
        width: String(SIZE),
        height: String(SIZE),
        rx: '6',
        class: 'fill-card stroke-border',
      },
      this.group,
    )
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
    svg('circle', { cx: '16', cy: '16', r: '6' }, icon)
    svg('circle', { cx: '16', cy: '16', r: '1.25', class: 'fill-current' }, icon)
    for (const d of ['M16 6v4', 'M16 22v4', 'M6 16h4', 'M22 16h4']) svg('path', { d }, icon)
    this.setLabel(label)

    // Keep the press away from the workspace's own gesture (a drag of the
    // canvas), as the zoom controls do.
    this.group.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.preventDefault()
    })
    this.group.addEventListener('click', (event) => {
      event.stopPropagation()
      this.recenter()
    })
    this.group.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      this.recenter()
    })

    workspace.getSvgGroup().appendChild(this.group)
    workspace.getComponentManager().addComponent({
      component: this,
      weight: WEIGHT,
      capabilities: [Blockly.ComponentManager.Capability.POSITIONABLE],
    })
    // Place it now instead of on the next resize.
    workspace.resize()
  }

  setLabel(label: string): void {
    this.group.setAttribute('aria-label', label)
    this.title.textContent = label
  }

  recenter(): void {
    this.workspace.scrollCenter()
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
    let placed = Blockly.uiPosition.bumpPositionRect(start, MARGIN, direction, savedPositions)

    // A short editor (the stacked phone layout) has no room above the zoom
    // column: stacking there would push the button out of the view. Sit
    // beside the column instead, in the same corner.
    const viewTop = metrics.absoluteMetrics.top
    const viewBottom = viewTop + metrics.viewMetrics.height
    if (placed.top < viewTop || placed.bottom > viewBottom) {
      const column = savedPositions.filter(
        (rect) => rect.right > start.left && rect.left < start.right,
      )
      const columnEdge =
        corner.horizontal === Blockly.uiPosition.horizontalPosition.RIGHT
          ? Math.min(start.left, ...column.map((rect) => rect.left)) - MARGIN - SIZE
          : Math.max(start.right, ...column.map((rect) => rect.right)) + MARGIN
      placed = new Blockly.utils.Rect(start.top, start.bottom, columnEdge, columnEdge + SIZE)
    }

    this.top = placed.top
    this.left = placed.left
    this.group.setAttribute('transform', `translate(${this.left},${this.top})`)
  }
}
