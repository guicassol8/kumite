import { expect, test } from '@playwright/test'

import { dragBlockFromFlyout } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// Visual walkthrough for #178 (finding #5), one screenshot per acceptance
// criterion. Switching the UI language while solving used to change the
// problem query key, drop the screen into `isPending` and unmount the editor
// subtree — the remounted editor was re-seeded with the state read when the
// page first loaded, and the next auto-save wrote that stale copy over the
// good one.
const evidence = (name: string) => `e2e/evidence/178/${name}.png`

// Assertions here count blocks, never read their labels: the labels on this
// same locale path have bugs of their own (#183, #202) and this spec must not
// go red because of them.
test.describe('switching the language inside the editor (#178)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Language Switch'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('keeps the blocks on the canvas across PT → ES → EN and after a reload', async ({
    page,
  }) => {
    // Four screenshots, two auto-save debounces, three Blockly re-renders and a
    // full reload do not fit the 30s default — this one walkthrough is the
    // whole acceptance criteria list of #178.
    test.setTimeout(90_000)

    const host = page.getByTestId('blockly-workspace')
    const blocks = host.locator('g.blocklyDraggable:visible')
    const statement = page.getByTestId('problem-statement-panel')

    // 01 — a solution built in Portuguese: the seeded root block plus the one
    // dragged from the toolbox.
    await page.goto(`/problem/${problemId}`)
    await expect(host.locator('svg.blocklySvg')).toBeVisible()
    await expect(statement).toContainText('Soma dos Pares')
    await dragBlockFromFlyout(page, 'Matemática')
    await expect(blocks).toHaveCount(2)
    // The auto-save debounce (500ms) — past it, the saved copy is the good one
    // that step 04 reads back.
    await page.waitForTimeout(600)
    await page.screenshot({ path: evidence('01-blocos-montados-pt') })

    // 02 — clicking ES translates the statement and leaves the canvas alone:
    // the editor is never unmounted, so both blocks stay exactly where they
    // were.
    await page.getByTestId('language-option-es').click()
    await expect(statement).toContainText('Suma de Pares')
    await expect(blocks).toHaveCount(2)
    await page.screenshot({ path: evidence('02-apos-trocar-para-es') })

    // 03 — same for EN, from an already-switched screen.
    await page.getByTestId('language-option-en').click()
    await expect(statement).toContainText('Sum of Evens')
    await expect(blocks).toHaveCount(2)
    await page.screenshot({ path: evidence('03-apos-trocar-para-en') })

    // 04 — the auto-save that fires after the switches wrote the *current*
    // workspace, not the one from page load: a reload brings both blocks back.
    await page.waitForTimeout(600)
    await page.reload()
    await expect(host.locator('svg.blocklySvg')).toBeVisible()
    await expect(blocks).toHaveCount(2)
    await page.screenshot({ path: evidence('04-persistido-apos-reload') })
  })
})
