import { somaDosPares } from '@kumite/blocks'
import { expect, type Locator, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import { AA_LARGE, AA_NORMAL, contrastRatio, measure, settle } from './support/contrast'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// #199 — the editor on a phone (findings #36 and #37 of the 2026-09-10
// diagnosis). Two things ate the room a participant has to build a solution
// at 390x844:
//
// - #37: the statement card (max-h-64) and the canvas shared the height left
//   between the header, the footer and the actions bar, and the canvas got
//   what the card did not take. The card now folds down to its header strip
//   (`problem-statement-toggle`), giving the canvas back ~190px.
// - #36: a toolbox category opens a flyout wider than the canvas right of the
//   toolbox (~294px over a 356px editor), and the only ways to put it away
//   were implicit: tap the category again, tap the bare toolbox, Esc, or tap
//   the canvas it covers. Below md an explicit "Fechar"
//   (`editor-flyout-close`) now sits over the editor while it is open. Once a
//   drag starts, Blockly 13 already hides the flyout on its own (measured
//   before #199, by mouse and by touch), so the block always lands on an
//   uncovered canvas — the third test pins that.
//
// Height and overlap are what jsdom cannot measure, so they are proved here.
// The round is closed (`seedEditorFixture`): nothing here submits, and a
// closed round holds no slot against the rest of the suite (#150). The
// Submeter half of acceptance 4 is `problem-screen-identity.spec.ts`, step 06.
const evidence = (name: string) => `e2e/evidence/199/${name}.png`

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

// The pt toolbox, in the order the curated toolbox lists it (`@kumite/blocks`).
const CATEGORIES = ['Lógica', 'Laços', 'Matemática', 'Texto', 'Listas', 'Variáveis'] as const

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox()
  if (!box) throw new Error(`expected "${testId}" to be laid out`)
  return box
}

/** The shell adds no scroll of its own when the route fits (#155). */
async function expectNoPageScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return root.scrollHeight - root.clientHeight
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

/** The footer sits below <main>, never on top of it (#155). */
async function expectFooterBelowMain(page: Page): Promise<void> {
  const mainBox = await page.locator('main').first().boundingBox()
  const footerBox = await page.getByTestId('app-footer').boundingBox()
  if (!mainBox || !footerBox) throw new Error('expected a full layout')
  expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height - 1)
}

function expectInside(inner: Box, outer: Box, what: string): void {
  expect(inner.x, `${what}: left edge`).toBeGreaterThanOrEqual(outer.x - 1)
  expect(inner.y, `${what}: top edge`).toBeGreaterThanOrEqual(outer.y - 1)
  expect(inner.x + inner.width, `${what}: right edge`).toBeLessThanOrEqual(
    outer.x + outer.width + 1,
  )
  expect(inner.y + inner.height, `${what}: bottom edge`).toBeLessThanOrEqual(
    outer.y + outer.height + 1,
  )
}

/** Blocks on the main canvas, nested ones included — never the flyout's. */
function blocksOnCanvas(page: Page): Promise<number> {
  return page
    .getByTestId('blockly-workspace')
    .locator('svg.blocklySvg .blocklyBlockCanvas g[data-id]')
    .count()
}

type Point = { x: number; y: number }

/**
 * A point that lands on the block itself. The middle of its box will not do:
 * on a C-shaped block ("se ... faça") that is the empty mouth, and a press
 * there lands on the flyout background and scrolls it instead.
 */
async function grabPoint(block: Locator): Promise<Point> {
  const point = await block.evaluate((g) => {
    const rect = g.getBoundingClientRect()
    for (let dy = 6; dy < rect.height; dy += 6) {
      for (let dx = 6; dx < rect.width; dx += 6) {
        const hit = document.elementFromPoint(rect.left + dx, rect.top + dy)
        if (hit && g.contains(hit)) return { x: rect.left + dx, y: rect.top + dy }
      }
    }
    return null
  })
  if (!point) throw new Error('no point of the block is on top')
  return point
}

/**
 * Drags a finger from `from` to `to` and keeps it down; the returned function
 * lifts it. CDP touch events need the context's `hasTouch`.
 */
async function touchDrag(page: Page, from: Point, to: Point): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
      ],
    })
  }
  return async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  }
}

/** Whether the page's focus is inside the editor's canvas — not on <body>. */
function focusIsOnCanvas(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="blockly-workspace"]')),
  )
}

/** Toolbox category by its visible name. */
function category(page: Page, name: string) {
  return page.locator('.blocklyToolbox').getByRole('treeitem', { name })
}

/** The toolbox's flyout — not the trashcan's, which is a `.blocklyFlyout` too. */
function toolboxFlyout(page: Page) {
  return page.locator('.blocklyToolboxFlyout')
}

test.describe('/problem/$id no celular (#199)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Problem Mobile'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    await page.addInitScript(
      ([key, saved]) => {
        window.localStorage.setItem(key as string, saved as string)
      },
      [workspaceStorageKey(participantId, problemId), JSON.stringify(somaDosPares)],
    )
  })

  async function openEditor(page: Page): Promise<void> {
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
  }

  test.describe('390x844', () => {
    test.use({ viewport: PHONE })

    test('o enunciado se recolhe e devolve a altura ao canvas', async ({ page }) => {
      await openEditor(page)
      const toggle = page.getByTestId('problem-statement-toggle')
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByTestId('problem-statement-body')).toBeVisible()

      const header = await boxOf(page, 'app-header')
      const notice = await boxOf(page, 'problem-closed-notice')
      const cardBefore = await boxOf(page, 'problem-statement-panel')
      const canvasBefore = await boxOf(page, 'blockly-workspace')
      const barBefore = await boxOf(page, 'problem-actions-bar')
      expect(barBefore.y + barBefore.height).toBeLessThanOrEqual(PHONE.height + 1)
      await page.screenshot({ path: evidence('01-celular-enunciado-aberto') })

      // Acceptance 3: one tap folds the statement down to its header strip.
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByTestId('problem-statement-body')).toHaveCount(0)
      // The title stays: the participant still sees which problem this is.
      await expect(page.getByTestId('problem-statement-panel')).toContainText('Soma dos Pares')
      await expect(toggle).toBeFocused()

      const cardAfter = await boxOf(page, 'problem-statement-panel')
      expect(cardAfter.height).toBeLessThanOrEqual(64)
      // Blockly follows its box through a ResizeObserver: poll, never read once.
      await expect
        .poll(async () => (await boxOf(page, 'blockly-workspace')).height)
        .toBeGreaterThanOrEqual(canvasBefore.height + 150)
      const canvasAfter = await boxOf(page, 'blockly-workspace')

      // Acceptance 4: the bar never moved — the canvas took the height, not it.
      const barAfter = await boxOf(page, 'problem-actions-bar')
      expect(Math.abs(barAfter.y - barBefore.y)).toBeLessThanOrEqual(1)
      expect(barAfter.y + barAfter.height).toBeLessThanOrEqual(PHONE.height + 1)
      await expect(page.getByTestId('problem-run-button')).toBeInViewport({ ratio: 1 })
      await expect(page.getByTestId('problem-clear-button')).toBeInViewport({ ratio: 1 })
      await expectNoPageScroll(page)
      await expectFooterBelowMain(page)

      // Blockly re-measured: its svg is the new canvas, not the old one.
      const svg = page.getByTestId('blockly-workspace').locator('svg.blocklySvg')
      await expect
        .poll(async () => Math.abs(((await svg.boundingBox())?.height ?? 0) - canvasAfter.height))
        .toBeLessThanOrEqual(2)

      // With the room back, the controls' column fits: on the 181px canvas of
      // a closed round the zoom buttons were cut above the canvas. The trash
      // is measured by its focus ring: its icon is a clipped sprite sheet,
      // and the unclipped <image> reaches far past the button it shows. The
      // zoom buttons are the app's own circles (#340).
      const controls = [
        ['zoom in', page.getByTestId('editor-zoom-in')],
        ['zoom out', page.getByTestId('editor-zoom-out')],
        ['trash', page.locator('.blocklyTrash > rect.blocklyFocusRing')],
        ['recenter', page.getByTestId('editor-recenter')],
      ] as const
      for (const [name, locator] of controls) {
        const count = await locator.count()
        expect(count, `${name}: rendered`).toBeGreaterThan(0)
        for (let i = 0; i < count; i++) {
          const box = await locator.nth(i).boundingBox()
          if (!box) throw new Error(`${name} #${i} has no box`)
          expectInside(box, canvasAfter, `${name} #${i}`)
        }
      }
      await page.screenshot({ path: evidence('02-celular-enunciado-recolhido') })

      test.info().annotations.push({
        type: 'heights at 390x844, closed round (#199)',
        description:
          `header ${Math.round(header.height)}px, notice ${Math.round(notice.height)}px; ` +
          `statement ${Math.round(cardBefore.height)}px → ${Math.round(cardAfter.height)}px; ` +
          `canvas ${Math.round(canvasBefore.height)}px → ${Math.round(canvasAfter.height)}px`,
      })

      // And back: the statement reads again, the bar still in place.
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByTestId('problem-statement-body')).toBeVisible()
      const barBack = await boxOf(page, 'problem-actions-bar')
      expect(Math.abs(barBack.y - barBefore.y)).toBeLessThanOrEqual(1)
    })

    test('Fechar fecha a caixa de blocos sem precisar de um arrasto', async ({ page }) => {
      await openEditor(page)
      await page.getByTestId('problem-statement-toggle').click()
      const flyout = toolboxFlyout(page)
      const close = page.getByTestId('editor-flyout-close')

      // Before any category opens there is nothing to close.
      await expect(close).toHaveCount(0)

      await category(page, 'Matemática').click()
      await expect(flyout).toBeVisible()

      // Acceptance 2: an explicit, reachable way out — inside the editor,
      // whole on screen, and a 44px touch target.
      await expect(close).toBeVisible()
      await expect(close).toBeInViewport({ ratio: 1 })
      await expect(close).toHaveAccessibleName('Fechar a lista de blocos')
      await expect(close).toContainText('Fechar')
      const closeBox = await boxOf(page, 'editor-flyout-close')
      const host = await boxOf(page, 'blockly-workspace')
      expectInside(closeBox, host, 'Fechar')
      expect(closeBox.width).toBeGreaterThanOrEqual(44)
      expect(closeBox.height).toBeGreaterThanOrEqual(44)
      // Nothing sits on top of it: a tap at its center lands on it.
      const onTop = await close.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        return hit !== null && (hit === node || node.contains(hit))
      })
      expect(onTop).toBe(true)
      await page.screenshot({ path: evidence('03-celular-flyout-com-fechar') })

      // A human press, held for a few frames: the button takes the focus on
      // mousedown, Blockly closes the flyout under it and React unmounts it
      // before the release — no click ever reaches it (#199 review).
      await page.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(150)
      await page.mouse.up()
      await expect(flyout).toBeHidden()
      await expect(close).toHaveCount(0)
      // The button is gone, and the focus it held went to the canvas, not to
      // <body>.
      await expect.poll(() => focusIsOnCanvas(page)).toBe(true)
      await page.screenshot({ path: evidence('04-celular-flyout-fechado') })

      // The implicit ways keep working, and the button follows them: the
      // same category again, and Esc.
      await category(page, 'Matemática').click()
      await expect(flyout).toBeVisible()
      await expect(close).toBeVisible()
      await category(page, 'Matemática').click()
      await expect(flyout).toBeHidden()
      await expect(close).toHaveCount(0)
      await category(page, 'Matemática').click()
      await expect(close).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(flyout).toBeHidden()
      await expect(close).toHaveCount(0)

      // The variables category is where "Criar variável..." sits — the
      // button must not cover it.
      await category(page, 'Variáveis').click()
      await expect(flyout).toBeVisible()
      const createVariable = flyout.locator('.blocklyFlyoutButton').first()
      await expect(createVariable).toBeVisible()
      const buttonBox = await createVariable.boundingBox()
      const closeOnVariables = await boxOf(page, 'editor-flyout-close')
      if (!buttonBox) throw new Error('"Criar variável..." has no box')
      const overlaps =
        buttonBox.x < closeOnVariables.x + closeOnVariables.width &&
        closeOnVariables.x < buttonBox.x + buttonBox.width &&
        buttonBox.y < closeOnVariables.y + closeOnVariables.height &&
        closeOnVariables.y < buttonBox.y + buttonBox.height
      expect(overlaps, 'Fechar covers "Criar variável..."').toBe(false)
      // A quick click lands the focus on the canvas too.
      await close.click()
      await expect(flyout).toBeHidden()
      await expect.poll(() => focusIsOnCanvas(page)).toBe(true)

      // How wide each flyout is at this width, for the record.
      const widths: string[] = []
      for (const name of CATEGORIES) {
        await category(page, name).click()
        await expect(flyout).toBeVisible()
        const box = await flyout.boundingBox()
        widths.push(`${name} ${Math.round(box?.width ?? 0)}px`)
        await category(page, name).click()
        await expect(flyout).toBeHidden()
      }
      test.info().annotations.push({
        type: 'flyout widths at 390x844 (#199)',
        description: `canvas ${Math.round(host.width)}px wide; ${widths.join(', ')}`,
      })
    })
  })

  // A finger, not a mouse: on the phone Blockly's gesture sees
  // `pointerType: 'touch'`, which is what CDP's touch events produce.
  test.describe('390x844, ao toque', () => {
    test.use({ viewport: PHONE, hasTouch: true })

    test('o flyout sai da frente quando o arrasto começa', async ({ page }) => {
      await openEditor(page)
      const flyout = toolboxFlyout(page)
      const close = page.getByTestId('editor-flyout-close')
      const before = await blocksOnCanvas(page)

      await category(page, 'Lógica').tap()
      await expect(flyout).toBeVisible()
      await expect(close).toBeVisible()
      const from = await grabPoint(flyout.locator('g.blocklyDraggable').first())
      const canvas = await boxOf(page, 'blockly-workspace')
      const toolbox = await page.locator('.blocklyToolbox').boundingBox()
      if (!toolbox) throw new Error('the toolbox has no box')

      // Mid-drag, the finger still down: the moment the participant needs to
      // see where the block is going. Blockly 13 already steps the flyout
      // aside here (measured on develop before #199, by mouse and by touch);
      // this pins it, since everything else on the phone relies on it.
      const release = await touchDrag(page, from, {
        x: canvas.x + canvas.width * 0.6,
        y: canvas.y + canvas.height * 0.6,
      })
      await expect(page.locator('.blocklyBlockDragSurface g[data-id]')).not.toHaveCount(0)

      // Acceptance 1: the whole canvas receives the block — no flyout over
      // it, and no Fechar left behind for a flyout that is gone.
      await expect(flyout).toBeHidden()
      await expect(close).toHaveCount(0)
      const uncovered = await page.evaluate(
        ([x, y]) => {
          const hit = document.elementFromPoint(x as number, y as number)
          return {
            flyout: Boolean(hit?.closest('.blocklyFlyout')),
            canvas: Boolean(hit?.closest('svg.blocklySvg')),
          }
        },
        [toolbox.x + toolbox.width + 30, canvas.y + 30],
      )
      expect(uncovered).toEqual({ flyout: false, canvas: true })
      await page.screenshot({ path: evidence('05-celular-arrasto-sem-flyout') })

      await release()
      await expect.poll(() => blocksOnCanvas(page)).toBeGreaterThan(before)
      await expect(flyout).toBeHidden()
      await expect(close).toHaveCount(0)
      await page.screenshot({ path: evidence('06-celular-bloco-solto') })
    })
  })

  test.describe('390x844, tema escuro', () => {
    test.use({ viewport: PHONE, colorScheme: 'dark' })

    test('o botão do enunciado e o Fechar mantêm o contraste', async ({ page }) => {
      await openEditor(page)
      const toggle = page.getByTestId('problem-statement-toggle')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await category(page, 'Matemática').click()
      const close = page.getByTestId('editor-flyout-close')
      await expect(close).toBeVisible()
      await settle(page)

      // "Fechar" is text: AA for normal text. The toggle is an icon: AA for
      // interface parts.
      const closeColors = await measure(close)
      expect(contrastRatio(closeColors.text, closeColors.background)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      )
      const toggleColors = await measure(toggle)
      expect(contrastRatio(toggleColors.text, toggleColors.background)).toBeGreaterThanOrEqual(
        AA_LARGE,
      )
      await page.screenshot({ path: evidence('09-celular-escuro-recolhido-com-fechar') })
    })
  })

  test.describe('1280x800', () => {
    test.use({ viewport: DESKTOP })

    test('o desktop não ganha nem o Fechar nem o recolher do celular', async ({ page }) => {
      await openEditor(page)
      const flyout = toolboxFlyout(page)

      await expect(page.getByTestId('problem-statement-toggle')).toHaveCount(0)
      // The desktop keeps its own collapse (#203).
      await expect(page.getByTestId('problem-statement-collapse')).toBeVisible()

      await category(page, 'Lógica').click()
      await expect(flyout).toBeVisible()
      await expect(page.getByTestId('editor-flyout-close')).toHaveCount(0)

      await page.screenshot({ path: evidence('07-desktop-sem-controles-do-celular') })

      // Acceptance 5: mid-drag, the desktop flyout behaves as it did before
      // #199 — Blockly's own hide as the drag starts, nothing of ours.
      const before = await blocksOnCanvas(page)
      const from = await grabPoint(flyout.locator('g.blocklyDraggable').first())
      const canvas = await boxOf(page, 'blockly-workspace')
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.6, {
        steps: 12,
      })
      await expect(flyout).toBeHidden()
      await page.mouse.up()
      await expect.poll(() => blocksOnCanvas(page)).toBeGreaterThan(before)
    })
  })
})
