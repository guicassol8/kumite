import { expect, type Locator, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// #340 — the editor's canvas controls are the app's own: zoom in, zoom out
// and recenter as 32px circles on the card/border tokens, stacked above the
// trashcan in the corner opposite the toolbox. Zooming is a view change only:
// no block moves and the autosave is never rewritten. Doubles as the PR's
// visual evidence.
const evidence = (name: string) => `e2e/evidence/340/${name}.png`

// Top-level blocks of the main workspace only — the flyouts are separate svgs.
const TOP_BLOCKS = 'svg.blocklySvg .blocklyBlockCanvas > g.blocklyDraggable'
const CONTROLS = ['editor-zoom-in', 'editor-zoom-out', 'editor-recenter'] as const
// `docs/design/tokens/tokens.css`, as the browser computes them.
const LIGHT = { card: 'rgb(255, 255, 255)', border: 'rgb(225, 221, 218)' }
// Blockly's default `zoom.scaleSpeed`; the limits are the editor's options.
const SCALE_SPEED = 1.2
const MIN_SCALE = 0.4
const MAX_SCALE = 2
// Longer than the autosave debounce (500ms).
const AUTOSAVE_SETTLE_MS = 1_000

type Box = { x: number; y: number; width: number; height: number }

const SAVED = JSON.stringify({
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: 'kumite_solve', id: 'kumiteSolveRoot', x: 40, y: 40, deletable: false },
      { type: 'math_number', id: 'numA', x: 100, y: 300, fields: { NUM: 1 } },
      { type: 'math_number', id: 'numB', x: 400, y: 200, fields: { NUM: 2 } },
    ],
  },
})

/** The workspace zoom, read from the block canvas `scale(...)` transform. */
async function canvasScale(page: Page) {
  const transform = await page
    .locator('svg.blocklySvg .blocklyBlockCanvas')
    .first()
    .getAttribute('transform')
  const match = /scale\(([\d.]+)\)/.exec(transform ?? '')
  return match ? Number(match[1]) : 1
}

/** Where each top-level block sits in workspace coordinates (zoom-free). */
function blockTransforms(page: Page) {
  return page
    .locator(TOP_BLOCKS)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('transform')))
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('the element has no box')
  return box
}

/** The trashcan, measured by its focus ring: its <image> is a clipped sprite sheet. */
const trash = (page: Page) => page.locator('.blocklyTrash > rect.blocklyFocusRing')

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

test.describe('editor canvas controls (#340)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Editor Controls'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [workspaceStorageKey(participantId, problemId), SAVED],
    )
  })

  async function openEditor(page: Page) {
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expect(page.locator(TOP_BLOCKS)).toHaveCount(3)
  }

  test.describe('on a desktop', () => {
    test.use({ colorScheme: 'light', viewport: { width: 1280, height: 800 } })

    test('three 32px circles on the card tokens, stacked above the trashcan', async ({ page }) => {
      await openEditor(page)

      const boxes: Box[] = []
      for (const testId of CONTROLS) {
        const control = page.getByTestId(testId)
        await expect(control).toBeVisible()
        const circle = control.locator(':scope > circle')
        await expect(circle).toHaveAttribute('r', '16')
        const paint = await circle.evaluate((node) => {
          const style = getComputedStyle(node)
          return { fill: style.fill, stroke: style.stroke }
        })
        expect(paint, testId).toEqual({ fill: LIGHT.card, stroke: LIGHT.border })
        const box = await boxOf(circle)
        expect(Math.abs(box.width - 32), `${testId} width`).toBeLessThanOrEqual(1)
        expect(Math.abs(box.height - 32), `${testId} height`).toBeLessThanOrEqual(1)
        boxes.push(box)
      }
      const [zoomIn, zoomOut, recenter] = boxes as [Box, Box, Box]

      // One column, in the corner opposite the toolbox (the toolbox is on the
      // left, so: right of the canvas's center).
      const canvas = await boxOf(page.getByTestId('blockly-workspace'))
      for (const box of boxes) {
        expect(Math.abs(box.x - zoomIn.x)).toBeLessThanOrEqual(1)
        expect(box.x).toBeGreaterThan(canvas.x + canvas.width / 2)
      }
      // Top to bottom: +, −, recenter, trashcan.
      const bin = await boxOf(trash(page))
      expect(zoomIn.y).toBeLessThan(zoomOut.y)
      expect(zoomOut.y).toBeLessThan(recenter.y)
      expect(recenter.y + recenter.height).toBeLessThan(bin.y)
      await page.screenshot({ path: evidence('01-controles-claro') })
    })

    test('zoom one step by click, Enter and Space, without moving a block or saving', async ({
      page,
    }) => {
      await openEditor(page)
      await page.waitForTimeout(AUTOSAVE_SETTLE_MS)
      const key = workspaceStorageKey(participantId, problemId)
      const savedBefore = await page.evaluate((k) => window.localStorage.getItem(k), key)
      const blocksBefore = await blockTransforms(page)
      const start = await canvasScale(page)

      await page.getByTestId('editor-zoom-in').click()
      await expect.poll(() => canvasScale(page)).toBeCloseTo(start * SCALE_SPEED, 5)

      const zoomOut = page.getByTestId('editor-zoom-out')
      await zoomOut.focus()
      await expect(zoomOut).toBeFocused()
      await page.keyboard.press('Enter')
      await expect.poll(() => canvasScale(page)).toBeCloseTo(start, 5)

      await page.keyboard.press('Space')
      await expect.poll(() => canvasScale(page)).toBeCloseTo(start / SCALE_SPEED, 5)

      // A view change only: the blocks keep their workspace positions and
      // the autosave is never rewritten (onChange never fired).
      await page.waitForTimeout(AUTOSAVE_SETTLE_MS)
      expect(await blockTransforms(page)).toEqual(blocksBefore)
      expect(await page.evaluate((k) => window.localStorage.getItem(k), key)).toBe(savedBefore)
    })

    test('the scale stops at maxScale and at minScale', async ({ page }) => {
      await openEditor(page)
      const zoomIn = page.getByTestId('editor-zoom-in')
      const zoomOut = page.getByTestId('editor-zoom-out')

      for (let i = 0; i < 10 && (await canvasScale(page)) < MAX_SCALE; i++) await zoomIn.click()
      await expect.poll(() => canvasScale(page)).toBe(MAX_SCALE)
      await zoomIn.click()
      await page.waitForTimeout(200)
      expect(await canvasScale(page)).toBe(MAX_SCALE)
      await page.screenshot({ path: evidence('02-zoom-max') })

      for (let i = 0; i < 20 && (await canvasScale(page)) > MIN_SCALE; i++) await zoomOut.click()
      await expect.poll(() => canvasScale(page)).toBe(MIN_SCALE)
      await zoomOut.click()
      await page.waitForTimeout(200)
      expect(await canvasScale(page)).toBe(MIN_SCALE)
    })

    test('the accessible labels follow the language', async ({ page }) => {
      await openEditor(page)
      const labels = () =>
        Promise.all(CONTROLS.map((testId) => page.getByTestId(testId).getAttribute('aria-label')))

      expect(await labels()).toEqual([
        'Aumentar o zoom',
        'Diminuir o zoom',
        'Centralizar a solução',
      ])

      await page.getByTestId('language-option-en').click()
      await expect.poll(labels).toEqual(['Zoom in', 'Zoom out', 'Center the solution'])

      await page.getByTestId('language-option-es').click()
      await expect.poll(labels).toEqual(['Acercar', 'Alejar', 'Centrar la solución'])
    })
  })

  test.describe('on a phone', () => {
    test.use({ colorScheme: 'light', viewport: { width: 390, height: 844 } })

    test('every control and the trashcan sit inside the canvas, overlapping nothing', async ({
      page,
    }) => {
      await openEditor(page)
      const canvas = await boxOf(page.getByTestId('blockly-workspace'))
      const boxes: [string, Box][] = []
      for (const testId of CONTROLS) {
        boxes.push([testId, await boxOf(page.getByTestId(testId).locator(':scope > circle'))])
      }
      boxes.push(['trash', await boxOf(trash(page))])

      for (const [name, box] of boxes) {
        expect(box.x, name).toBeGreaterThanOrEqual(canvas.x)
        expect(box.y, name).toBeGreaterThanOrEqual(canvas.y)
        expect(box.x + box.width, name).toBeLessThanOrEqual(canvas.x + canvas.width)
        expect(box.y + box.height, name).toBeLessThanOrEqual(canvas.y + canvas.height)
      }
      for (const [i, [a, boxA]] of boxes.entries()) {
        for (const [b, boxB] of boxes.slice(i + 1)) {
          expect(overlaps(boxA, boxB), `${a} × ${b}`).toBe(false)
        }
      }
      await page.screenshot({ path: evidence('03-celular') })
    })
  })
})
