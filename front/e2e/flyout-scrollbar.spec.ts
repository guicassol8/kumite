import { expect, test } from '@playwright/test'

import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// #204 — the ghost scrollbar left in the middle of the editor after closing a
// toolbox category.
//
// Blockly hides the flyout's scrollbar through the *presentation attribute*
// `display="none"` (`core/scrollbar.ts`, `updateDisplay_`), and Tailwind v4's
// preflight declares `svg { display: block }`. A presentation attribute has no
// weight in the cascade, so any CSS rule beats it: the SVG stayed computed as
// `block`. It is not a child of the flyout — Blockly inserts it as a sibling
// straight into `.injectionDiv`, with `z-index: 30` (`core/css.ts`) — so
// hiding the flyout never took it along, and it floated over the canvas right
// where the flyout used to end. The fix is the `svg[display='none']` rule in
// `front/src/index.css`; `src/test/blockly-scrollbar-css.test.ts` guards it in CI.
//
// Two `.blocklyFlyoutScrollbar` elements exist in the DOM: the toolbox
// flyout's and the trashcan flyout's (`trashcan: true`). Every assertion here
// targets the toolbox one through the adjacent-sibling selector.
const evidence = (name: string) => `e2e/evidence/204/${name}.png`

/**
 * The scrollbar *handle* is the only part a participant can see — the track is
 * transparent. Blockly parks idle scrollbars as a full-size `<svg>` whose
 * handle has height 0 (the trashcan flyout's, and the toolbox flyout's before
 * it is ever opened), so measuring the outer `<svg>` would count boxes that
 * paint nothing. Every assertion below measures handles for that reason.
 */
const HANDLE_SELECTOR = '.injectionDiv .blocklyScrollbarHandle'

/**
 * 1280x600: the event's notebooks, minus browser chrome. The height matters —
 * the spec is only meaningful while the flyout actually overflows and Blockly
 * really draws a handle for it. Measured across 900/800/720/700/650/600/560px
 * of viewport height, the first overflow appears between 650 and 600: at 650
 * and taller *no* curated category overflows, the handle is 0px high, and the
 * ghost is an empty box — the bug is there in the DOM but invisible, and every
 * assertion below would pass vacuously.
 *
 * Nothing here is tuned to make the spec pass, and the number is not load-
 * bearing in silence: the first test asserts `toBeVisible()` on the *handle*
 * while the flyout is open, and Playwright counts a zero-area box as hidden.
 * Raise this viewport past the overflow threshold and that precondition fails
 * loudly (verified at 1280x720) instead of going quietly green.
 */
test.use({ viewport: { width: 1280, height: 600 } })

/**
 * A curated category whose flyout overflows at the viewport above (measured:
 * a 284px handle on a 317px track). `Lógica` is the other one that overflows
 * there (295px on the same track); `Matemática`, `Texto`, `Listas` and
 * `Variáveis` all fit, so Blockly draws no handle for them and they cannot
 * leave a ghost behind.
 */
const SCROLLING_CATEGORY = 'Laços'

test.describe('the flyout scrollbar leaves no ghost behind (#204)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Flyout Scrollbar'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('closing a category removes its scrollbar from the canvas', async ({ page }) => {
    const host = page.getByTestId('blockly-workspace')
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyToolboxFlyout')
    // The ghost: the toolbox flyout's own scrollbar, not the trashcan's.
    const ghost = page.locator('.blocklyToolboxFlyout + .blocklyFlyoutScrollbar')

    await page.goto(`/problem/${problemId}`)
    await expect(host.locator('svg.blocklySvg')).toBeVisible()

    // AC4 — open: the flyout overflows and its scrollbar is on screen. This is
    // also the precondition for everything below: a hidden bar here would mean
    // the flyout fits, and there would be nothing to leave behind.
    await toolbox.getByRole('treeitem', { name: SCROLLING_CATEGORY }).click()
    await expect(flyout).toBeVisible()
    await expect(ghost).toBeVisible()
    await expect(ghost.locator('.blocklyScrollbarHandle')).toBeVisible()
    await page.screenshot({ path: evidence('01-flyout-aberto') })

    // AC1 — closing by clicking the same category again.
    await toolbox.getByRole('treeitem', { name: SCROLLING_CATEGORY }).click()
    await expect(flyout).toBeHidden()
    await expect(ghost).toBeHidden()
    await page.screenshot({ path: evidence('02-flyout-fechado') })

    // AC1 through the other path — reopen, then close by clicking the canvas.
    await toolbox.getByRole('treeitem', { name: SCROLLING_CATEGORY }).click()
    await expect(flyout).toBeVisible()
    await expect(ghost).toBeVisible()
    // Far corner of the canvas on purpose: the open flyout covers the left of
    // the workspace and would swallow the click, and the bottom-right is clear
    // of both the seeded root block and the main scrollbars.
    const canvas = await page.locator('.injectionDiv').boundingBox()
    if (!canvas) throw new Error('expected the Blockly injection div to have a box')
    await page.mouse.click(canvas.x + canvas.width - 120, canvas.y + canvas.height - 120)
    await expect(flyout).toBeHidden()
    await expect(ghost).toBeHidden()
    await page.screenshot({ path: evidence('03-fechado-clicando-fora') })
  })

  test('opening and closing categories repeatedly accumulates nothing', async ({ page }) => {
    const host = page.getByTestId('blockly-workspace')
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyToolboxFlyout')
    const ghost = page.locator('.blocklyToolboxFlyout + .blocklyFlyoutScrollbar')
    const paintedHandles = () =>
      page.locator(HANDLE_SELECTOR).evaluateAll(
        (nodes) =>
          nodes.filter((node) => {
            const rect = node.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          }).length,
      )

    await page.goto(`/problem/${problemId}`)
    await expect(host.locator('svg.blocklySvg')).toBeVisible()
    // The two bars of the main canvas, and nothing else.
    const baseline = await paintedHandles()
    expect(baseline).toBe(2)

    // AC3 — three rounds over three categories: the one that overflows, one
    // that fits, and the dynamic one.
    for (const category of [SCROLLING_CATEGORY, 'Matemática', 'Variáveis']) {
      for (let round = 0; round < 3; round++) {
        await toolbox.getByRole('treeitem', { name: category }).click()
        await expect(flyout).toBeVisible()
        await toolbox.getByRole('treeitem', { name: category }).click()
        await expect(flyout).toBeHidden()
      }
    }

    await expect(ghost).toBeHidden()
    expect(await paintedHandles()).toBe(baseline)
    await page.screenshot({ path: evidence('04-ciclos') })
  })

  test('with the flyout closed, every scrollbar sits on a workspace edge', async ({ page }) => {
    const host = page.getByTestId('blockly-workspace')
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyToolboxFlyout')
    const injection = page.locator('.injectionDiv')

    await page.goto(`/problem/${problemId}`)
    await expect(host.locator('svg.blocklySvg')).toBeVisible()
    await toolbox.getByRole('treeitem', { name: SCROLLING_CATEGORY }).click()
    await expect(flyout).toBeVisible()
    await toolbox.getByRole('treeitem', { name: SCROLLING_CATEGORY }).click()
    await expect(flyout).toBeHidden()

    // AC2, read as the user confirmed on 2026-09-20: no scrollbar anywhere but
    // the workspace edges. The main canvas bars are Blockly's and stay exactly
    // as they are — what must not exist is a bar floating in the middle.
    const area = await injection.boundingBox()
    if (!area) throw new Error('expected the Blockly injection div to have a box')

    // Blockly insets its own bars a few px from the edge (`SCROLLBAR_MARGIN`).
    const tolerance = 24
    const boxes = await page.locator(HANDLE_SELECTOR).evaluateAll((nodes) =>
      nodes
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
    )

    // The two main-canvas bars have to be among them, or the assertion below
    // would hold for an editor that simply drew nothing.
    expect(boxes).toHaveLength(2)

    for (const box of boxes) {
      const touchesRight = box.x + box.width >= area.x + area.width - tolerance
      const touchesBottom = box.y + box.height >= area.y + area.height - tolerance
      expect(
        touchesRight || touchesBottom,
        `a scrollbar at x=${box.x}, y=${box.y} (${box.width}x${box.height}) is not on an edge of the workspace (${area.x},${area.y} ${area.width}x${area.height})`,
      ).toBe(true)
    }

    await page.screenshot({ path: evidence('05-barras-nas-bordas') })
  })
})
