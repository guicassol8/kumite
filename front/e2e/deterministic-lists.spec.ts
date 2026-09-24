import { expect, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual evidence for #182: the editor no longer offers the one block option
// whose generated code is not deterministic — `lists_getIndex` with
// `WHERE = RANDOM`, which emitted `Math.random()` and made the same workspace
// pass "Executar", fail "Submeter" and re-judge differently every attempt.
//
// The block is seeded into localStorage instead of dragged out of the flyout:
// the drag is the fragile part of driving Blockly, and the seeded state is
// byte-for-byte what the editor saves — which is also what makes the second
// test possible at all.
const evidence = (name: string) => `e2e/evidence/182/${name}.png`

const LIST_BLOCK = '[data-id="pegaItem"]'

/** Root block plus a `lists_getIndex` reading the input list, with `WHERE`
 * set to whatever the test needs. */
function workspaceWith(where: string) {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'kumite_solve',
          id: 'kumiteSolveRoot',
          x: 40,
          y: 40,
          inputs: {
            RETURN: {
              block: {
                type: 'lists_getIndex',
                id: 'pegaItem',
                fields: { MODE: 'GET', WHERE: where },
                inputs: { VALUE: { block: { type: 'kumite_input', id: 'entrada' } } },
              },
            },
          },
        },
      ],
    },
  }
}

test.describe('deterministic list blocks (#182)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let participantId: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } =
      await seedEditorFixture('Deterministic Lists'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test('the WHERE dropdown offers four modes and never "aleatório"', async ({ page }) => {
    await page.addInitScript(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [workspaceStorageKey(participantId, problemId), JSON.stringify(workspaceWith('FIRST'))],
    )

    await page.goto(`/problem/${problemId}`)
    const host = page.getByTestId('blockly-workspace')
    await expectBlocklyInjected(page)

    // 01 — the block is on the canvas, reading the first item of the list.
    const block = page.locator(LIST_BLOCK)
    await expect(block).toHaveCount(1)
    await expect(block.getByText('primeiro')).toBeVisible()
    await page.screenshot({ path: evidence('01-bloco-na-area') })

    // 02 — opening the WHERE dropdown: four modes, and the random one is gone.
    // Blockly renders the menu in its own drop-down div, outside the block.
    await block.getByText('primeiro').click()
    const menu = page.locator('.blocklyDropDownDiv .blocklyMenu')
    await expect(menu).toBeVisible()
    await expect(menu.locator('.blocklyMenuItem')).toHaveCount(4)
    await expect(menu.getByText('aleatório')).toHaveCount(0)
    // Blockly fades the drop-down in. `toBeVisible` is already true at the
    // first frame, so screenshotting here catches a half-transparent menu and
    // the evidence is unreadable — wait for the transition to land instead.
    await expect
      .poll(() =>
        page.locator('.blocklyDropDownDiv').evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe('1')
    await page.screenshot({ path: evidence('02-dropdown-sem-aleatorio') })
  })

  test('a solution saved with the random mode opens on a deterministic one', async ({ page }) => {
    // The decision on #182: a workspace saved before the fix is coerced — in
    // silence, no banner and no toast — to the field's default. The
    // participant keeps their blocks; only the mode that could not be judged
    // twice the same way is gone.
    await page.addInitScript(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [workspaceStorageKey(participantId, problemId), JSON.stringify(workspaceWith('RANDOM'))],
    )

    await page.goto(`/problem/${problemId}`)
    const host = page.getByTestId('blockly-workspace')
    await expectBlocklyInjected(page)

    // 03 — the block survived the load, with the indexed mode instead of the
    // random one, and nothing on screen is shouting about it.
    const block = page.locator(LIST_BLOCK)
    await expect(block).toHaveCount(1)
    await expect(block.getByText('aleatório')).toHaveCount(0)
    // `nº` is Blockly's pt-BR label for `FROM_START`, the field's first
    // option and so the value it falls back to: an indexed read, which is
    // deterministic. The `AT` socket it brings back is the proof the
    // fallback went through the field's own validator.
    await expect(block.getByText('nº', { exact: true })).toBeVisible()
    await page.screenshot({ path: evidence('03-solucao-salva-coagida') })
  })
})
