import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CANVAS_CONTROL_IDS,
  type CanvasControl,
  type CanvasControls,
  createCanvasControls,
} from '@/lib/blockly-canvas-controls'

const LABELS = {
  zoomIn: 'Aumentar o zoom',
  zoomOut: 'Diminuir o zoom',
  recenter: 'Centralizar a solução',
}
const TEST_IDS = ['editor-zoom-in', 'editor-zoom-out', 'editor-recenter'] as const

let host: HTMLDivElement
let workspace: Blockly.WorkspaceSvg
let controls: CanvasControls

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  workspace = Blockly.inject(host, {
    media: '/blockly-media/',
    zoom: { controls: false },
    trashcan: true,
  })
  controls = createCanvasControls(workspace, LABELS)
})

afterEach(() => {
  controls.dispose()
  workspace.dispose()
  host.remove()
  vi.restoreAllMocks()
})

function button(testId: string): SVGGElement {
  const element = host.querySelector<SVGGElement>(`[data-testid="${testId}"]`)
  if (!element) throw new Error(`${testId} was not rendered`)
  return element
}

function component(id: string): CanvasControl {
  return workspace.getComponentManager().getComponent(id) as unknown as CanvasControl
}

const press = (testId: string, key: string) =>
  button(testId).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const click = (testId: string) =>
  button(testId).dispatchEvent(new MouseEvent('click', { bubbles: true }))

describe('createCanvasControls', () => {
  it('renders three accessible, labelled round buttons inside the workspace svg', () => {
    const labels = {
      'editor-zoom-in': LABELS.zoomIn,
      'editor-zoom-out': LABELS.zoomOut,
      'editor-recenter': LABELS.recenter,
    }
    for (const testId of TEST_IDS) {
      const element = button(testId)
      expect(workspace.getSvgGroup().contains(element)).toBe(true)
      expect(element.getAttribute('role')).toBe('button')
      expect(element.getAttribute('tabindex')).toBe('0')
      expect(element.getAttribute('aria-label')).toBe(labels[testId])
      expect(element.querySelector('title')?.textContent).toBe(labels[testId])
      const background = element.querySelector(':scope > circle')
      expect(background?.getAttribute('r')).toBe('16')
      expect(background?.getAttribute('class')).toBe('fill-card stroke-border')
      expect(element.querySelector('rect')).toBeNull()
    }
  })

  it('registers as positionables stacked above the trashcan: recenter, zoom out, zoom in', () => {
    const manager = workspace.getComponentManager()
    const positionables = manager.getComponents(
      Blockly.ComponentManager.Capability.POSITIONABLE,
      true,
    )

    expect(positionables).toEqual([
      workspace.trashcan,
      component(CANVAS_CONTROL_IDS.recenter),
      component(CANVAS_CONTROL_IDS.zoomOut),
      component(CANVAS_CONTROL_IDS.zoomIn),
    ])
  })

  it('zooms one step in or out on click, Enter and Space, and ignores other keys', () => {
    // jsdom has no getCTM: the zoom itself is Blockly's, proven in the e2e.
    const zoomCenter = vi.spyOn(workspace, 'zoomCenter').mockImplementation(() => {})

    click('editor-zoom-in')
    press('editor-zoom-in', 'Enter')
    press('editor-zoom-in', ' ')
    press('editor-zoom-in', 'a')
    expect(zoomCenter.mock.calls).toEqual([[1], [1], [1]])

    zoomCenter.mockClear()
    click('editor-zoom-out')
    press('editor-zoom-out', 'Enter')
    press('editor-zoom-out', ' ')
    press('editor-zoom-out', 'a')
    expect(zoomCenter.mock.calls).toEqual([[-1], [-1], [-1]])
  })

  it('centers the view on click, keeping the zoom', () => {
    const scrollCenter = vi.spyOn(workspace, 'scrollCenter')
    const setScale = vi.spyOn(workspace, 'setScale')

    click('editor-recenter')

    expect(scrollCenter).toHaveBeenCalledOnce()
    expect(setScale).not.toHaveBeenCalled()
  })

  it('centers the view on Enter and Space', () => {
    const scrollCenter = vi.spyOn(workspace, 'scrollCenter')

    press('editor-recenter', 'Enter')
    press('editor-recenter', ' ')
    press('editor-recenter', 'a')

    expect(scrollCenter).toHaveBeenCalledTimes(2)
  })

  it('relabels all three when the language changes', () => {
    controls.setLabels({ zoomIn: 'Zoom in', zoomOut: 'Zoom out', recenter: 'Center the solution' })

    expect(button('editor-zoom-in').getAttribute('aria-label')).toBe('Zoom in')
    expect(button('editor-zoom-out').querySelector('title')?.textContent).toBe('Zoom out')
    expect(button('editor-recenter').getAttribute('aria-label')).toBe('Center the solution')
    expect(button('editor-recenter').querySelector('title')?.textContent).toBe(
      'Center the solution',
    )
  })

  describe('position', () => {
    // A 360px-wide view with no scrollbars in the way. The components are
    // placed the way the ComponentManager does: by weight, each one given
    // the rects of those already placed.
    function metrics(height: number) {
      return {
        viewMetrics: { height, width: 360, top: 0, left: 0 },
        absoluteMetrics: { top: 0, left: 0 },
        toolboxMetrics: { height: 0, width: 0, position: Blockly.utils.toolbox.Position.LEFT },
        flyoutMetrics: { height: 0, width: 0, position: Blockly.utils.toolbox.Position.LEFT },
      } as unknown as Blockly.MetricsManager.UiMetrics
    }
    const rect = (top: number, bottom: number, left: number, right: number) =>
      new Blockly.utils.Rect(top, bottom, left, right)
    const plain = (box: Blockly.utils.Rect) => ({
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
    })

    // The trashcan as Blockly places it: 47×60, 20px from the corner.
    function layout(height: number, others: Blockly.utils.Rect[] = []) {
      const saved = [...others, rect(height - 80, height - 20, 293, 340)]
      const place = (key: keyof typeof CANVAS_CONTROL_IDS) => {
        const control = component(CANVAS_CONTROL_IDS[key])
        control.position(metrics(height), saved)
        const box = control.getBoundingRectangle()
        saved.push(box)
        return box
      }
      const recenter = place('recenter')
      const zoomOut = place('zoomOut')
      const zoomIn = place('zoomIn')
      return { placed: { recenter, zoomOut, zoomIn }, saved }
    }

    beforeEach(() => {
      // No scrollbars: the corner is then exactly MARGIN (20px) from the edges.
      vi.spyOn(workspace, 'scrollbar', 'get').mockReturnValue(null)
    })

    it('stacks one column above the trashcan when the view is tall enough', () => {
      const { placed } = layout(600)

      // 20px above the trashcan (top 520), then 8px between the circles.
      expect(plain(placed.recenter)).toEqual({ top: 468, bottom: 500, left: 308, right: 340 })
      expect(plain(placed.zoomOut)).toEqual({ top: 428, bottom: 460, left: 308, right: 340 })
      expect(plain(placed.zoomIn)).toEqual({ top: 388, bottom: 420, left: 308, right: 340 })
      expect(button('editor-zoom-in').getAttribute('transform')).toBe('translate(308,388)')
    })

    it('moves what does not fit to the next column, inside the view, overlapping nothing', () => {
      // The 181px canvas of a closed round on a phone; something placed
      // elsewhere (along the toolbox) is not part of the column.
      const elsewhere = rect(0, 181, 0, 40)
      const { placed, saved } = layout(181, [elsewhere])

      for (const box of Object.values(placed)) {
        expect(box.top).toBeGreaterThanOrEqual(0)
        expect(box.bottom).toBeLessThanOrEqual(181)
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(360)
      }
      for (const [i, a] of saved.entries()) {
        for (const b of saved.slice(i + 1)) {
          if (a === elsewhere || b === elsewhere) continue
          expect(a.intersects(b), `${JSON.stringify(a)} × ${JSON.stringify(b)}`).toBe(false)
        }
      }
      // The recenter stays on the trashcan; + sits right above − beside them.
      expect(placed.recenter.left).toBe(308)
      expect(placed.zoomOut.right).toBe(273)
      expect(placed.zoomIn.left).toBe(placed.zoomOut.left)
      expect(placed.zoomOut.top - placed.zoomIn.bottom).toBe(8)
    })
  })

  it('removes all three from the workspace on dispose', () => {
    controls.dispose()

    for (const testId of TEST_IDS) {
      expect(host.querySelector(`[data-testid="${testId}"]`)).toBeNull()
    }
    for (const id of Object.values(CANVAS_CONTROL_IDS)) {
      expect(workspace.getComponentManager().getComponent(id)).toBeUndefined()
    }
  })
})
