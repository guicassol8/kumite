import { expect, test } from '@playwright/test'

import {
  dragBlockFromFlyout,
  EDITOR_TEST_TIMEOUT_MS,
  editorTestTimeout,
  expectBlocklyInjected,
} from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'

// Visual walkthrough for #6, one screenshot per acceptance criterion.
// #7 moved the editor behind a real problem id, so `beforeAll` seeds one via
// the shared fixture and every test signs in with a seeded token (#149).
const evidence = (name: string) => `e2e/evidence/6/${name}.png`

test.describe('the workspace auto-save (#6)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Workspace Autosave'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('the workspace auto-saves per problem, restores on reopen, and Limpar blocos resets it', async ({
    page,
  }) => {
    // Four editor mounts: the first visit, a reload, the reopen, a reload.
    test.setTimeout(editorTestTimeout(4))
    const host = page.getByTestId('blockly-workspace')
    const draggedBlock = host.locator('g.blocklyDraggable:visible').first()

    // 01 — a dragged block survives a reload of the same screen (auto-saved,
    // debounced, then read back).
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await dragBlockFromFlyout(page, 'Matemática')
    await expect(draggedBlock).toBeVisible()
    await page.waitForTimeout(600)
    await page.reload()
    await expectBlocklyInjected(page)
    await expect(host.locator('g.blocklyDraggable:visible').first()).toBeVisible()
    await page.screenshot({ path: evidence('01-persisted-across-reload') })

    // 02 — navigating away and back restores the same saved blocks.
    await page.goto('/')
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expect(host.locator('g.blocklyDraggable:visible').first()).toBeVisible()
    await page.screenshot({ path: evidence('02-restored-on-reopen') })

    // 03 — "Limpar blocos" asks in the app's own dialog (#283), not the
    // browser's: cancelling it leaves every block where it was.
    const blocks = host.locator('g.blocklyDraggable:visible')
    const before = await blocks.count()
    expect(before).toBeGreaterThan(1)
    const clearDialog = page.getByTestId('problem-clear-dialog')
    await page.getByTestId('problem-clear-button').click()
    await expect(clearDialog).toBeVisible()
    await page.screenshot({ path: 'e2e/evidence/283/01-dialogo-limpar.png' })
    await page.getByTestId('problem-clear-cancel').click()
    await expect(clearDialog).toBeHidden()
    await expect(blocks).toHaveCount(before)

    // Confirming resets the workspace to just the root block (it isn't
    // offered by the toolbox, so losing it would strand the user) and removes
    // the saved state, so it stays that way after a reload.
    await page.getByTestId('problem-clear-button').click()
    await page.getByTestId('problem-clear-confirm').click()
    await expect(clearDialog).toBeHidden()
    await expect(host.locator('g.blocklyDraggable:visible')).toHaveCount(1)
    await page.reload()
    await expectBlocklyInjected(page)
    await expect(host.locator('g.blocklyDraggable:visible')).toHaveCount(1)
    await page.screenshot({ path: evidence('03-cleared-and-stays-empty') })
  })

  test('the workspace still mounts and accepts blocks when its saved state is unreadable', async ({
    page,
  }) => {
    test.setTimeout(EDITOR_TEST_TIMEOUT_MS)
    const host = page.getByTestId('blockly-workspace')

    // 04 — the persistence layer throwing on every access must not crash the
    // screen: it mounts and still accepts a dragged block, just without
    // persistence.
    //
    // The stub throws only for the `kumite:workspace:*` keys, not for all of
    // localStorage: `/problem/$id` is behind `requireAuth` and the session
    // token lives in localStorage too (`session.ts`), so a stub that threw on
    // everything would bounce this test to /login before Blockly ever mounted.
    // Scoping it to the workspace keys leaves the guard alone and still proves
    // what this test is for — auto-save is best-effort, and losing it does not
    // take the editor down with it.
    await page.addInitScript(() => {
      const real = window.localStorage
      const refuse = (key: string) => {
        if (key.startsWith('kumite:workspace:')) throw new Error('localStorage unavailable')
      }
      const stub: Storage = {
        getItem: (key: string) => {
          refuse(key)
          return real.getItem(key)
        },
        setItem: (key: string, value: string) => {
          refuse(key)
          real.setItem(key, value)
        },
        removeItem: (key: string) => {
          refuse(key)
          real.removeItem(key)
        },
        clear: () => real.clear(),
        key: (index: number) => real.key(index),
        get length() {
          return real.length
        },
      }
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => stub })
    })
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await dragBlockFromFlyout(page, 'Matemática')
    await expect(host.locator('g.blocklyDraggable:visible').first()).toBeVisible()
    await page.screenshot({ path: evidence('04-localstorage-unavailable') })
  })
})
