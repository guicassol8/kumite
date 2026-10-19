import { somaDosPares } from '@kumite/blocks'
import { expect, type Locator, type Page, test } from '@playwright/test'

import { editorTestTimeout, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'
import { expectPaintedAsComputed, type Rgb } from './support/screenshot-pixels'

// #258: toggling dark mode on `/problem/$id` after a reload, or after one
// Executar, used to leave headless Chromium's screenshot in the light theme
// while every computed style already read dark. The 2026-10-19 spike could not
// reproduce it — not on develop, not at the #257 merge where it was reported,
// with or without `--disable-audio-output` (#425), nor in `channel: 'chromium'`
// — so there is no cure to apply, only this guard: each capture's pixels are
// asserted against the computed theme, so a stale paint fails here instead of
// passing as evidence. Findings and the matrix: the `## Achados` on #258.
const evidence = (name: string) => `e2e/evidence/258/${name}.png`

test.use({ colorScheme: 'light', viewport: { width: 1280, height: 800 } })

/** Clear of the cards' rounded corner and 1 px border. */
const INSET = 8

/** Toggles the theme from light (nothing saved, light scheme) to dark. */
async function toggleToDark(page: Page): Promise<void> {
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByTestId('header-theme-toggle').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
}

/** A dark surface, not merely a matching one: every channel well below mid-grey. */
function expectDark(color: Rgb, what: string): void {
  expect(Math.max(color.r, color.g, color.b), `${what} computes a light background`).toBeLessThan(
    64,
  )
}

/**
 * Asserts the page surfaces of `/problem/$id` are painted dark in `png`: the
 * statement card, the page itself under the (transparent) actions bar, and
 * the Blockly canvas — never the header, whose chrome is dark in both themes.
 */
async function expectProblemPaintedDark(page: Page, png: Buffer): Promise<void> {
  const samples: [string, Locator, Parameters<typeof expectPaintedAsComputed>[3]][] = [
    ['problem-statement-panel', page.getByTestId('problem-statement-panel'), {}],
    [
      'the page under problem-actions-bar',
      page.getByTestId('problem-actions-bar'),
      { paintedBy: page.locator('body') },
    ],
    // Top-right: clear of the toolbox and flyout, above the zoom controls.
    [
      'the blockly canvas',
      page.getByTestId('blockly-workspace').locator('svg.blocklySvg'),
      { corner: 'top-right' },
    ],
  ]
  for (const [what, locator, options] of samples) {
    expectDark(
      await expectPaintedAsComputed(page, locator, png, { inset: INSET, ...options }),
      what,
    )
  }
}

test.describe('tema escuro pintado após reload em / (#258)', () => {
  test('a: / — reload e alternar para o escuro pinta o escuro', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('header-theme-toggle')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('header-theme-toggle')).toBeVisible()
    await toggleToDark(page)

    const png = await page.screenshot({ path: evidence('01-inicio-escuro-apos-reload') })
    expectDark(
      await expectPaintedAsComputed(page, page.getByTestId('home-screen'), png, {
        inset: INSET,
        paintedBy: page.locator('body'),
      }),
      'the page under home-screen',
    )
  })
})

test.describe('/problem/$id — tema escuro pintado após reload ou Executar (#258)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Dark Repaint'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    await page.addInitScript(
      ([key, saved]) => window.localStorage.setItem(key as string, saved as string),
      [workspaceStorageKey(participantId, problemId), JSON.stringify(somaDosPares)],
    )
  })

  test('b: reload e alternar para o escuro pinta o escuro', async ({ page }) => {
    test.setTimeout(editorTestTimeout(2))
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await page.reload()
    await expectBlocklyInjected(page)
    await toggleToDark(page)

    const png = await page.screenshot({ path: evidence('02-problema-escuro-apos-reload') })
    await expectProblemPaintedDark(page, png)
  })

  test('c: Executar e alternar para o escuro pinta o escuro', async ({ page }) => {
    test.setTimeout(editorTestTimeout(1))
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    // The run is over when the three cases are back AND Executar is enabled
    // again (the same terminal state as `problem-panels.spec.ts`'s runExamples).
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-summary')).toHaveText('3/3 casos')
    await expect(page.getByTestId('problem-run-button')).toBeEnabled()
    await toggleToDark(page)

    const png = await page.screenshot({ path: evidence('03-problema-escuro-apos-executar') })
    await expectProblemPaintedDark(page, png)
  })
})
