import type { WorkspaceState } from '@kumite/blocks'
import { expect, test } from '@playwright/test'

import { editorTestTimeout, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  participantIdOf,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual walkthrough for #202: an organizer saw the input block "become a
// variable" and change its name on a language switch. Nothing is renamed —
// only the input block's label is translated (`entrada`/`entrada`/`input`),
// on purpose. One screenshot per step: pt, en, es, then a reload in es that
// restores the pt-era autosave.
const evidence = (name: string) => `e2e/evidence/202/${name}.png`

// `soma ← entrada; retornar soma`, plus a hand-made variable called `input` —
// the en label of the input block, so the most confusing name possible.
const somaDaEntrada: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'kumiteSolveRoot',
        // Right of the open Variables flyout, so a screenshot shows both.
        x: 360,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'guardaSoma',
              fields: { VAR: { id: 'varSoma' } },
              inputs: { VALUE: { block: { type: 'kumite_input', id: 'blocoEntrada' } } },
            },
          },
          RETURN: {
            block: { type: 'variables_get', id: 'leSoma', fields: { VAR: { id: 'varSoma' } } },
          },
        },
      },
    ],
  },
  variables: [
    { name: 'soma', id: 'varSoma' },
    { name: 'input', id: 'varInput' },
  ],
}

test.describe('a language switch renames no variable (#202)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string
  let storageKey: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken } = await seedEditorFixture('Locale Variable Identity'))
    storageKey = workspaceStorageKey(await participantIdOf(participantToken), problemId)
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    // Seeds the autosave only when there is none, so the reload in step 04
    // reads back what the editor itself saved, not this seed again.
    await page.addInitScript(
      ([key, state]) => {
        if (!window.localStorage.getItem(key as string)) {
          window.localStorage.setItem(key as string, state as string)
        }
      },
      [storageKey, JSON.stringify(somaDaEntrada)],
    )
  })

  test('the input block is relabeled and every variable keeps its name across pt → en → es and a reload', async ({
    page,
  }) => {
    // Two editor mounts: the first visit and the reload in step 04.
    test.setTimeout(editorTestTimeout(2))
    const host = page.getByTestId('blockly-workspace')
    const toolbox = page.locator('.blocklyToolbox')
    // The main workspace only: the flyout is a workspace too, with its own
    // block canvas, and it stays open between steps.
    const canvas = host.locator('svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas')
    const flyout = page.locator('.blocklyFlyout')

    async function expectVariablesIntact(category: string, inputLabel: string) {
      // On the canvas: the input block carries the locale's label, and the
      // `soma` get/set blocks still read `soma`.
      await expect(canvas.getByText(inputLabel, { exact: true })).toHaveCount(1)
      await expect(canvas.getByText('soma', { exact: true })).toHaveCount(2)
      // In the Variables flyout: both variables, under their original names.
      await toolbox.getByRole('treeitem', { name: category }).click()
      await expect(flyout.getByText('soma', { exact: true }).first()).toBeVisible()
      await expect(flyout.getByText('input', { exact: true }).first()).toBeVisible()
    }

    // 01 — pt: the input block says `entrada`, the variables are `soma` and
    // `input`.
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
    await expectVariablesIntact('Variáveis', 'entrada')
    await page.screenshot({ path: evidence('01-pt-entrada-e-variaveis') })

    // 02 — en: only the input block's label changes (`input`); the variables
    // keep their names.
    await page.getByTestId('language-option-en').click()
    await expect(toolbox.getByRole('treeitem', { name: 'Variables' })).toBeVisible()
    await expectVariablesIntact('Variables', 'input')
    await page.screenshot({ path: evidence('02-en-mesmas-variaveis') })

    // 03 — es: back to `entrada`, same variables.
    await page.getByTestId('language-option-es').click()
    await expect(toolbox.getByRole('treeitem', { name: 'Bucles' })).toBeVisible()
    await expectVariablesIntact('Variables', 'entrada')
    await page.screenshot({ path: evidence('03-es-mesmas-variaveis') })

    // 04 — a reload in es restores the autosave, still with the same names.
    await page.waitForTimeout(600)
    await page.reload()
    await expectBlocklyInjected(page)
    await expectVariablesIntact('Variables', 'entrada')
    await page.screenshot({ path: evidence('04-es-restaurado-do-autosave') })
  })
})
