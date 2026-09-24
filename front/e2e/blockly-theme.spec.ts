import { expect, type Locator, type Page, test } from '@playwright/test'

import { dragBlockFromFlyout } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// #218 — the kumite Blockly theme: every category in its `--block-*` colour,
// the solve block in ink with paper text, the input block in red, the chrome
// on the identity's paper/card surfaces, and a live light ↔ dark swap that
// neither reloads nor loses a block. Doubles as the PR's visual evidence.
const evidence = (name: string) => `e2e/evidence/218/${name}.png`

// `docs/design/tokens/tokens.css`, as the browser computes them.
const BLOCK = {
  logic: 'rgb(42, 117, 186)', // --block-logic #2A75BA
  variables: 'rgb(167, 103, 0)', // --block-variables #A76700
  root: 'rgb(42, 37, 35)', // --block-root #2A2523
  input: 'rgb(221, 40, 36)', // --block-input #DD2824
}
// The six toolbox rows (pt labels) and their bar colour.
const CATEGORY_BARS: [string, string][] = [
  ['Lógica', BLOCK.logic],
  ['Laços', 'rgb(41, 134, 70)'], // --block-loops #298646
  ['Matemática', 'rgb(107, 100, 186)'], // --block-math #6B64BA
  ['Texto', 'rgb(0, 130, 130)'], // --block-text #008282
  ['Listas', 'rgb(142, 87, 165)'], // --block-lists #8E57A5
  ['Variáveis', BLOCK.variables],
]
const ROOT_TEXT = 'rgb(243, 241, 239)' // --chrome-foreground #F3F1EF
const LIGHT = {
  canvas: 'rgb(242, 240, 236)', // --background-2 #F2F0EC
  card: 'rgb(255, 255, 255)', // --card #FFFFFF
  border: 'rgb(225, 221, 218)', // --border #E1DDDA
}
const DARK = {
  canvas: 'rgb(27, 23, 22)', // .dark --card #1B1716
  card: 'rgb(27, 23, 22)', // .dark --card #1B1716
  border: 'rgb(49, 45, 44)', // .dark --border #312D2C
}

const TOP_BLOCKS = 'svg.blocklySvg .blocklyBlockCanvas > g.blocklyDraggable'

function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property)
}

/** The chrome the theme owns: canvas, toolbox and the grid dots. */
async function chrome(page: Page) {
  return {
    // With a grid on, the background rect is filled by the (transparent) dot
    // pattern and Blockly paints `workspaceBackgroundColour` on the svg itself.
    canvas: await computed(page.locator('svg.blocklySvg').first(), 'background-color'),
    toolbox: await computed(page.locator('.blocklyToolbox'), 'background-color'),
    grid: await computed(
      page.locator("svg.blocklySvg pattern[id^='blocklyGridPattern'] line").first(),
      'stroke',
    ),
  }
}

/** Fill of the first top-level block of a theme style on the main canvas. */
function blockFill(page: Page, style: string): Promise<string> {
  return computed(
    page.locator(`svg.blocklySvg .blocklyBlockCanvas g.${style} > path.blocklyPath`).first(),
    'fill',
  )
}

async function openEditor(page: Page, problemId: string) {
  await page.goto(`/problem/${problemId}`)
  await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator(TOP_BLOCKS).first()).toBeVisible()
}

test.describe('the kumite Blockly theme', () => {
  test.skip(!hasOrganizerCredentials, 'set ORGANIZER_EMAIL/ORGANIZER_PASSWORD to seed a problem')

  let problemId = ''
  let participantToken = ''

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Tema Blockly'))
  })

  test.describe('on a light OS', () => {
    test.use({ colorScheme: 'light', viewport: { width: 1280, height: 800 } })

    test('paints the identity, then swaps to dark live and keeps it across a language switch', async ({
      page,
    }) => {
      test.setTimeout(120_000)
      await seedParticipantToken(page, participantToken)
      await openEditor(page, problemId)

      // Solve block: ink, with paper text.
      expect(await blockFill(page, 'kumite_root_blocks')).toBe(BLOCK.root)
      expect(
        await computed(
          page.locator('.kumite_root_blocks > .blocklyLabelField > .blocklyText').first(),
          'fill',
        ),
      ).toBe(ROOT_TEXT)

      // The input block (Variables) is the canvas's one red; a Logic block
      // takes --block-logic.
      await dragBlockFromFlyout(page, 'Variáveis')
      await expect.poll(() => blockFill(page, 'kumite_input_blocks')).toBe(BLOCK.input)
      await dragBlockFromFlyout(page, 'Lógica')
      await expect.poll(() => blockFill(page, 'logic_blocks')).toBe(BLOCK.logic)

      // Category bars: every one of the six, 4px, in its own --block-* token.
      for (const [name, colour] of CATEGORY_BARS) {
        const row = page
          .locator('.blocklyToolbox')
          .getByRole('treeitem', { name })
          .locator('.blocklyToolboxCategory')
        expect(await computed(row, 'border-left-color'), name).toBe(colour)
        expect(await computed(row, 'border-left-width'), name).toBe('4px')
      }

      // Chrome on paper.
      expect(await chrome(page)).toEqual({
        canvas: LIGHT.canvas,
        toolbox: LIGHT.card,
        grid: LIGHT.border,
      })
      // Close the flyout the last drag left open, for a clean screenshot.
      await page.keyboard.press('Escape')
      await page.screenshot({ path: evidence('01-editor-claro') })

      // Live swap: no reload (the marker survives), same blocks, same colours.
      const blocks = page.locator(TOP_BLOCKS)
      const count = await blocks.count()
      await page.evaluate(() => {
        ;(window as unknown as { __noReload: boolean }).__noReload = true
      })
      await page.getByTestId('header-theme-toggle').click()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect
        .poll(() => chrome(page))
        .toEqual({
          canvas: DARK.canvas,
          toolbox: DARK.card,
          grid: DARK.border,
        })
      expect(await blockFill(page, 'kumite_root_blocks')).toBe(BLOCK.root)
      expect(await blockFill(page, 'kumite_input_blocks')).toBe(BLOCK.input)
      expect(await blockFill(page, 'logic_blocks')).toBe(BLOCK.logic)
      await expect(blocks).toHaveCount(count)
      expect(
        await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
      ).toBe(true)
      await page.screenshot({ path: evidence('02-editor-escuro-apos-alternar') })

      // A language switch rebuilds every block — the dark theme stays.
      await page.getByTestId('language-option-es').click()
      await expect(page.locator('.blocklyToolbox').getByText('Bucles')).toBeVisible()
      await expect(blocks).toHaveCount(count)
      expect(await chrome(page)).toEqual({
        canvas: DARK.canvas,
        toolbox: DARK.card,
        grid: DARK.border,
      })
      expect(await blockFill(page, 'kumite_root_blocks')).toBe(BLOCK.root)
      await page.screenshot({ path: evidence('03-escuro-apos-trocar-idioma') })
    })
  })

  test.describe('on a dark OS with nothing saved', () => {
    test.use({ colorScheme: 'dark', viewport: { width: 390, height: 844 } })

    test('opens already in the dark editor theme', async ({ page }) => {
      await seedParticipantToken(page, participantToken)
      await openEditor(page, problemId)

      await expect
        .poll(() => chrome(page))
        .toEqual({
          canvas: DARK.canvas,
          toolbox: DARK.card,
          grid: DARK.border,
        })
      expect(await blockFill(page, 'kumite_root_blocks')).toBe(BLOCK.root)
      // Zoom and trash are dark sprites: inverted on the dark canvas.
      expect(await computed(page.locator('.blocklyZoom image').first(), 'filter')).toBe('invert(1)')
      await page.screenshot({ path: evidence('04-celular-escuro') })
    })
  })
})
