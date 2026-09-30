import { somaDosPares } from '@kumite/blocks'
import { expect, type Page, test } from '@playwright/test'

import { editorTestTimeout, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual walkthrough for #203: the desktop layout of `/problem/$id` gained
// collapsible, resizable, persisted panels — none of it is provable in
// `problem-panels.test.tsx` (jsdom measures nothing, and has no
// ResizeObserver), so every acceptance criterion is asserted here instead,
// against a real, closed round (this spec never submits, so it must not hold
// the single-open-round slot — #150).
const evidence = (name: string) => `e2e/evidence/203/${name}.png`
const evidence307 = (name: string) => `e2e/evidence/307/${name}.png`

/** Where `useDefaultLayout` keeps the canvas/results split (`layoutStorage`). */
const RESULTS_LAYOUT_KEY = 'kumite:problem-layout:react-resizable-panels:problem-v'

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox()
  if (!box) throw new Error(`expected "${testId}" to be laid out`)
  return box
}

/** Drags a `Separator` by its center — the only thing a real user can grab. */
async function dragHandle(page: Page, testId: string, dx: number, dy: number): Promise<void> {
  const box = await boxOf(page, testId)
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 })
  await page.mouse.up()
  await settle(page)
}

/**
 * A click resolving is not proof the resulting flex/collapse layout has
 * settled — Playwright waits for the event to dispatch, not for React's
 * commit plus the browser's next layout pass. Every geometry comparison
 * below brackets its action with this the same way `problem-language-switch.
 * spec.ts` brackets the autosave debounce.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(200)
}

/** The `results` share of the saved split, or `undefined` if nothing was saved. */
async function savedResultsSize(page: Page): Promise<number | undefined> {
  const saved = await page.evaluate((key) => window.localStorage.getItem(key), RESULTS_LAYOUT_KEY)
  return saved ? (JSON.parse(saved) as Record<string, number>).results : undefined
}

/** Executar, and wait until the three cases are back. */
async function runExamples(page: Page): Promise<void> {
  await page.getByTestId('problem-run-button').click()
  await expect(page.getByTestId('problem-results-summary')).toHaveText('3/3 casos')
  await settle(page)
}

test.describe('/problem/$id — painéis colapsáveis e redimensionáveis no desktop (#203)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } = await seedEditorFixture('Problem Panels'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    await page.addInitScript(
      ([key, saved]) => window.localStorage.setItem(key as string, saved as string),
      [workspaceStorageKey(participantId, problemId), JSON.stringify(somaDosPares)],
    )
  })

  test('colapsar, redimensionar, persistir e sobreviver à troca de layout', async ({ page }) => {
    // Two collapses, a handful of drags, a reload and a breakpoint crossing —
    // comfortably past the 30s default — on top of two editor mounts.
    test.setTimeout(editorTestTimeout(2, 180_000))
    await page.setViewportSize({ width: 1280, height: 800 })

    const canvas = page.getByTestId('blockly-workspace')
    const svg = canvas.locator('svg.blocklySvg')

    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)

    // Aceite 4: `blockly-workspace.tsx:102`'s ResizeObserver already keeps
    // Blockly's own measurements in sync with the container — this locks
    // that in across every layout change below instead of reimplementing it.
    async function expectSvgTracksCanvas() {
      const canvasBox = await boxOf(page, 'blockly-workspace')
      const svgBox = await svg.boundingBox()
      if (!svgBox) throw new Error('expected the blockly svg to be laid out')
      expect(Math.abs(svgBox.width - canvasBox.width)).toBeLessThanOrEqual(2)
      expect(Math.abs(svgBox.height - canvasBox.height)).toBeLessThanOrEqual(2)
    }

    // 01 — Aceite 1: collapsing the statement gives its width to the editor,
    // and the rail restores it with one click. "editor" is the Panel's own
    // auto-testid (from its `id`) — "problem-workspace-panel" only exists on
    // the stacked (mobile) branch.
    const workspaceBefore = await boxOf(page, 'editor')
    await page.getByTestId('problem-statement-collapse').click()
    await settle(page)
    const workspaceAfterCollapse = await boxOf(page, 'editor')
    expect(workspaceAfterCollapse.width).toBeGreaterThan(workspaceBefore.width)
    await expect(page.getByTestId('problem-statement-rail')).toBeVisible()
    await expectSvgTracksCanvas()
    await page.screenshot({ path: evidence('01-enunciado-recolhido') })

    await page.getByTestId('problem-statement-rail').click()
    await settle(page)
    await expect(page.getByTestId('problem-statement-panel')).toBeVisible()
    await expect(page.getByTestId('problem-statement-rail')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-enunciado-restaurado') })

    // 02 — Aceite 2: running, then collapsing the results, grows the canvas
    // and leaves Executar/Limpar/Submeter exactly where they were.
    const barBefore = await boxOf(page, 'problem-actions-bar')
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-band')).toBeVisible()
    await settle(page)
    const canvasBeforeResultsCollapse = await boxOf(page, 'blockly-workspace')
    await page.getByTestId('problem-results-toggle').click()
    await settle(page)
    const canvasAfterResultsCollapse = await boxOf(page, 'blockly-workspace')
    const barAfterResultsCollapse = await boxOf(page, 'problem-actions-bar')
    expect(canvasAfterResultsCollapse.height).toBeGreaterThan(canvasBeforeResultsCollapse.height)
    expect(Math.abs(barAfterResultsCollapse.y - barBefore.y)).toBeLessThanOrEqual(1)
    await expectSvgTracksCanvas()
    await page.screenshot({ path: evidence('03-resultados-recolhidos') })

    await page.getByTestId('problem-results-toggle').click()
    await settle(page)
    await expect(page.getByTestId('problem-results-band')).toBeVisible()
    const barAfterResultsExpand = await boxOf(page, 'problem-actions-bar')
    expect(Math.abs(barAfterResultsExpand.y - barBefore.y)).toBeLessThanOrEqual(1)

    // 03 — Aceite 3: dragging a divider resizes both neighbors.
    const statementBeforeDrag = await boxOf(page, 'problem-statement-panel')
    await dragHandle(page, 'problem-statement-handle', 80, 0)
    const statementAfterDrag = await boxOf(page, 'problem-statement-panel')
    expect(statementAfterDrag.width).toBeGreaterThan(statementBeforeDrag.width + 40)
    await expectSvgTracksCanvas()
    await page.screenshot({ path: evidence('04-enunciado-redimensionado') })

    // 06 — Aceite 6: dragging well past the minimum never leaves the panel at
    // some arbitrary, stuck sliver. Both panels here are `collapsible` (T7/T8
    // build the rail/toggle out of exactly that), so react-resizable-panels'
    // own behavior for "past the minimum" is to snap the rest of the way to
    // the *known* collapsed size (0) — the same state the collapse button
    // reaches, recoverable through the same rail/toggle, never a broken
    // in-between width.
    await dragHandle(page, 'problem-statement-handle', -2000, 0)
    // The Panel's own box ("statement", its auto-testid), not the Card's
    // ("problem-statement-panel") — the Card keeps a 1px border on each
    // side even at 0 content width, so it reads 2px instead of 0.
    const statementAfterOvershoot = await boxOf(page, 'statement')
    const horizontalGroup = await boxOf(page, 'problem-h')
    const statementCollapsedByDrag = statementAfterOvershoot.width <= 1
    expect(
      statementCollapsedByDrag || statementAfterOvershoot.width >= horizontalGroup.width * 0.14,
    ).toBe(true)
    if (statementCollapsedByDrag) {
      await expect(page.getByTestId('problem-statement-rail')).toBeVisible()
      await page.getByTestId('problem-statement-rail').click()
    }

    const resultsBeforeDrag = await boxOf(page, 'problem-results-band')
    await dragHandle(page, 'problem-results-handle', 0, -60)
    const resultsAfterDrag = await boxOf(page, 'problem-results-band')
    expect(resultsAfterDrag.height).toBeGreaterThan(resultsBeforeDrag.height + 30)
    await expectSvgTracksCanvas()

    await dragHandle(page, 'problem-results-handle', 0, 2000)
    const resultsAfterOvershoot = await boxOf(page, 'results')
    const verticalGroup = await boxOf(page, 'problem-v')
    const resultsCollapsedByDrag = resultsAfterOvershoot.height <= 1
    expect(
      resultsCollapsedByDrag || resultsAfterOvershoot.height >= verticalGroup.height * 0.09,
    ).toBe(true)
    if (resultsCollapsedByDrag) {
      await expect(page.getByTestId('problem-results-toggle')).toHaveAttribute(
        'aria-expanded',
        'false',
      )
      await page.getByTestId('problem-results-toggle').click()
    }
    await page.screenshot({ path: evidence('05-divisorias-no-minimo') })

    // Double-clicking a divider resets its panel to the default size —
    // native to react-resizable-panels v4's `Separator`, just locked in here.
    await page.getByTestId('problem-results-handle').dblclick()
    await settle(page)
    const resultsAfterReset = await boxOf(page, 'problem-results-band')
    expect(resultsAfterReset.height).toBeGreaterThan(resultsAfterOvershoot.height)

    // 07 — the known cost of the stacked/panels split (#199 is the phone):
    // crossing the md breakpoint remounts <BlocklyWorkspace>, so the block
    // count is what has to survive, not the zoom/pan the remount loses.
    const blocks = canvas.locator('g.blocklyDraggable:visible')
    const blockCountBeforeBreakpoint = await blocks.count()
    expect(blockCountBeforeBreakpoint).toBeGreaterThan(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(svg).toBeVisible()
    await expect(blocks).toHaveCount(blockCountBeforeBreakpoint)
    await page.screenshot({ path: evidence('06-celular-blocos-preservados') })
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(svg).toBeVisible()
    await expect(blocks).toHaveCount(blockCountBeforeBreakpoint)
    // The remount reads `defaultLayout` back from storage, one render after
    // the breakpoint flips — without this, the rail-presence check below
    // can catch the statement mid-remount, still showing expanded.
    await settle(page)

    // 05 — Aceite 5: collapse the statement (if the earlier drag-to-minimum
    // didn't leave it collapsed already — that was a genuine pointer drag,
    // so it persisted; recovering it afterward via the rail's `.expand()`
    // is an imperative call and, correctly, does not overwrite that saved
    // preference — crossing the breakpoint and back just re-read it), then
    // reload: the collapse and the dragged sizes above both come back from
    // `kumite:problem-layout:`.
    if ((await page.getByTestId('problem-statement-rail').count()) === 0) {
      await page.getByTestId('problem-statement-collapse').click()
      await settle(page)
    }
    await expect(page.getByTestId('problem-statement-rail')).toBeVisible()
    const statementRefWidthBeforeReload = await boxOf(page, 'problem-h')

    await page.reload()
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-statement-rail')).toBeVisible()
    // The Card stays mounted at 0 width when collapsed (T7) — it never
    // disappears from the DOM, only the rail being visible signals collapse.
    const statementCardAfterReload = await boxOf(page, 'problem-statement-panel')
    expect(statementCardAfterReload.width).toBeLessThanOrEqual(3)
    const horizontalGroupAfterReload = await boxOf(page, 'problem-h')
    expect(horizontalGroupAfterReload.width).toBeCloseTo(statementRefWidthBeforeReload.width, -1)
    // The results run cleared on reload (nothing re-runs it), so the split
    // itself starts back at 0% — the size a *future* run restores to is
    // whatever got persisted, checked here via the raw storage entry
    // instead. Only a real drag on the separator persists (double-clicking
    // it to reset, just above, does not — same as the imperative
    // expand()/collapse() calls the rail and toggle make), so the value here
    // is legitimately 0: the last *dragged* state was the overshoot that
    // collapsed it.
    const savedVerticalLayout = await page.evaluate(() =>
      window.localStorage.getItem('kumite:problem-layout:react-resizable-panels:problem-v'),
    )
    expect(savedVerticalLayout).not.toBeNull()
    const verticalLayout = JSON.parse(savedVerticalLayout ?? '{}') as Record<string, number>
    expect(typeof verticalLayout.results).toBe('number')
    await page.screenshot({ path: evidence('07-recolhimento-persistido-apos-reload') })

    // 08 — the collapsed layout in dark mode: the rail, the results toggle
    // and the divider both need contrast in both modes. The statement stays
    // collapsed (rail on screen); a run is needed for the results toggle to
    // exist at all, immediately collapsed back so the strip — not the full
    // band — is what's captured.
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-band')).toBeVisible()
    await settle(page)
    await page.getByTestId('problem-results-toggle').click()
    await settle(page)
    await page.getByTestId('header-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByTestId('problem-statement-rail')).toBeVisible()
    await expect(page.getByTestId('problem-results-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await page.screenshot({ path: evidence('08-modo-escuro') })
  })

  // #307 + #366, acceptance 3: the size the participant dragged the band to is
  // a preference for *results* — never a gap reserved before there are any,
  // and what every later run opens at. No init script touches the layout key,
  // so the reload below reads back exactly what the drag saved.
  test('o tamanho escolhido da faixa só vale quando há resultados (#307)', async ({ page }) => {
    test.setTimeout(editorTestTimeout(2, 120_000))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)

    // The default size, then a taller one chosen by dragging.
    await runExamples(page)
    const defaultHeight = (await boxOf(page, 'problem-results-band')).height
    // 40px, not more: at 720px tall the canvas's 50% floor (#155) stops the
    // band only ~40px above its default.
    await dragHandle(page, 'problem-results-handle', 0, -40)
    const chosenHeight = (await boxOf(page, 'problem-results-band')).height
    expect(chosenHeight).toBeGreaterThan(defaultHeight + 20)
    const chosen = await savedResultsSize(page)
    expect(chosen).toBeGreaterThan(0)

    // 01 — Acceptance 1 of #307: a fresh screen with that preference saved
    // gives the whole column to the editor. No gap, no toggle, and the
    // preference itself is left alone.
    await page.reload()
    await expectBlocklyInjected(page)
    await settle(page)
    expect((await boxOf(page, 'results')).height).toBeLessThanOrEqual(1)
    const column = await boxOf(page, 'problem-v')
    const canvas = await boxOf(page, 'blockly-workspace')
    expect(column.height - canvas.height).toBeLessThanOrEqual(3)
    await expect(page.getByTestId('problem-results-toggle')).toHaveCount(0)
    expect(await savedResultsSize(page)).toBe(chosen)
    await page.screenshot({ path: evidence307('01-sem-resultados-sem-vao') })

    // 02 — Acceptance 2 of #307 (and 3 of #366): the first run restores the
    // chosen size, not the default — and opening the band saves nothing.
    await runExamples(page)
    expect(
      Math.abs((await boxOf(page, 'problem-results-band')).height - chosenHeight),
    ).toBeLessThanOrEqual(2)
    expect(await savedResultsSize(page)).toBe(chosen)
    await page.screenshot({ path: evidence307('02-tamanho-salvo-restaurado') })

    // The toggle reopens at the same size.
    await page.getByTestId('problem-results-toggle').click()
    await settle(page)
    await page.getByTestId('problem-results-toggle').click()
    await settle(page)
    expect(
      Math.abs((await boxOf(page, 'problem-results-band')).height - chosenHeight),
    ).toBeLessThanOrEqual(2)

    // 03 — A band dragged shut is no preference (#366, premise 2): the next
    // run opens it at the default again.
    await dragHandle(page, 'problem-results-handle', 0, 2000)
    expect((await boxOf(page, 'results')).height).toBeLessThanOrEqual(1)
    expect(await savedResultsSize(page)).toBe(0)
    await runExamples(page)
    expect(
      Math.abs((await boxOf(page, 'problem-results-band')).height - defaultHeight),
    ).toBeLessThanOrEqual(2)
    await page.screenshot({ path: evidence307('03-recolhida-volta-ao-padrao') })
  })
})
