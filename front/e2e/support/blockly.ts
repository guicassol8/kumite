import { expect, type Page, type TestInfo, test } from '@playwright/test'

// Drag helpers shared by the specs that build a solution on the canvas.
// The category label is a parameter because the toolbox is translated
// ("Matemática" in pt, "Matemáticas" in es, "Math" in en) — a hardcoded label
// would tie the helper to a single UI language.
//
// Playwright only collects `*.spec.ts` under `testDir`, so this file is a
// helper, not a suite.

// Waiting for Blockly to inject is the one step every editor spec blocks on,
// and the one that stalls first on a machine under memory pressure: the
// renderer sits on `problem-loading` with the page still blank until the
// swap clears (#246). It gets its own budget, BLOCKLY_INJECTION_TIMEOUT_MS,
// instead of the global 30 s `expect` ceiling — raising that ceiling would
// make every real failure anywhere in the suite wait twice as long.
//
// An assertion can never outlive its test, though: a 60 s wait inside a
// default 30 s test still dies at 30 s. So the test budget is derived from
// the injection budget (`editorTestTimeout`), and `expectBlocklyInjected`
// refuses to run when the test's timeout cannot hold the injections it has
// already waited for — the coherence is checked at run time, not by review.
// These are ceilings only: on an idle machine nothing waits longer.

/** How long a single Blockly injection may take before it counts as a failure. */
export const BLOCKLY_INJECTION_TIMEOUT_MS = 60_000

/** What an editor test gets for everything besides waiting for injections. */
const DEFAULT_REST_MS = 30_000

/**
 * Test budget for a spec that waits for `injections` Blockly injections and
 * needs `restMs` for everything else it does (never less than 30 s).
 */
export function editorTestTimeout(injections: number, restMs = DEFAULT_REST_MS): number {
  return injections * BLOCKLY_INJECTION_TIMEOUT_MS + Math.max(restMs, DEFAULT_REST_MS)
}

/** Budget for the common case: one injection plus the usual 30 s. */
export const EDITOR_TEST_TIMEOUT_MS = editorTestTimeout(1)

// Injections already awaited by each running test (hooks included — a
// `beforeEach` shares its test's TestInfo and its timeout).
const injectionsByTest = new WeakMap<TestInfo, number>()

/**
 * Waits for Blockly to inject into the editor host, with the injection
 * budget. Throws before waiting when the current test's timeout is shorter
 * than `editorTestTimeout(n)` for this, its n-th, injection — the assertion
 * would otherwise be cut short by the test itself.
 */
export async function expectBlocklyInjected(page: Page): Promise<void> {
  const info = test.info()
  const injection = (injectionsByTest.get(info) ?? 0) + 1
  injectionsByTest.set(info, injection)
  const needed = editorTestTimeout(injection)
  if (info.timeout !== 0 && info.timeout < needed) {
    throw new Error(
      `expectBlocklyInjected: injection #${injection} needs a test timeout of at least ` +
        `${needed} ms (editorTestTimeout(${injection})), but this test has ${info.timeout} ms. ` +
        'Declare it with test.setTimeout(editorTestTimeout(n, rest)) or ' +
        'test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS }).',
    )
  }
  await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible({
    timeout: BLOCKLY_INJECTION_TIMEOUT_MS,
  })
}

/** Opens `category` in the toolbox and drags its first block onto the canvas. */
export async function dragBlockFromFlyout(page: Page, category: string): Promise<void> {
  const host = page.getByTestId('blockly-workspace')
  const toolbox = page.locator('.blocklyToolbox')
  await toolbox.getByRole('treeitem', { name: category }).click()
  const flyoutBlock = page.locator('.blocklyFlyout g.blocklyDraggable').first()
  await expect(flyoutBlock).toBeVisible()
  const source = await flyoutBlock.boundingBox()
  const canvas = await host.boundingBox()
  if (!source || !canvas) throw new Error('the flyout block or the canvas has no box')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.6, {
    steps: 12,
  })
  await page.mouse.up()
}
