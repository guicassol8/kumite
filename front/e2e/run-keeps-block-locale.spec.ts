import { raizDesabilitada, somaDosPares, type WorkspaceState } from '@kumite/blocks'
import { expect, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual evidence for #183: Executar generated the code without the UI
// locale, and `generateSolution` used to re-register the kumite blocks
// globally — so in an es or en UI every block created after the click came out
// in pt: the input block of the Variables flyout (`input` → `entrada`) and the
// fresh root of "Limpar blocos" (`return`/`devolver` → `retornar`). The blocks
// already on the canvas never changed, which is why the checks below always
// create a new block after the run. Since #380 codegen never touches the
// registry; this spec stays as a regression lock.
//
// Submeter is covered by the screen test (problem.$id.test.tsx): the fixture
// closes its round, and opening one would take the single open-round slot
// (#150).
const evidence = (name: string) => `e2e/evidence/183/${name}.png`

let problemId: string
let participantToken: string
let participantId: string

async function openWith(page: Page, saved: WorkspaceState) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string)
    },
    [workspaceStorageKey(participantId, problemId), JSON.stringify(saved)],
  )
  await page.goto(`/problem/${problemId}`)
  await expectBlocklyInjected(page)
}

async function runExamples(page: Page) {
  await page.getByTestId('problem-run-button').click()
  await expect(page.getByTestId('problem-results-summary')).toBeVisible()
}

/** "Limpar blocos": the fresh root comes from the global block registry. */
async function clearBlocks(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('problem-clear-button').click()
}

test.describe('Executar keeps the block locale (#183)', () => {
  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId, participantToken, participantId } =
      await seedEditorFixture('Run Keeps Block Locale'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
  })

  test.describe('browser in English (en-US)', () => {
    test.use({ locale: 'en-US' })

    test('the flyout and a cleared root stay in English after a run', async ({ page }) => {
      const host = page.getByTestId('blockly-workspace')

      // 01 — before the run, the root speaks English.
      await openWith(page, somaDosPares)
      await expect(host.getByText('solve', { exact: true })).toBeVisible()
      await expect(host.getByText('return', { exact: true })).toBeVisible()
      await page.screenshot({ path: evidence('01-en-antes-de-executar') })

      // 02 — after the run, the input block offered by the flyout is `input`.
      await runExamples(page)
      await page.locator('.blocklyToolbox').getByRole('treeitem', { name: 'Variables' }).click()
      const flyout = page.locator('.blocklyFlyout')
      await expect(flyout.getByText('input', { exact: true })).toBeVisible()
      await expect(flyout.getByText('entrada', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: evidence('02-en-flyout-depois-de-executar') })

      // 03 — the root "Limpar blocos" creates is English too.
      await clearBlocks(page)
      await expect(host.getByText('solve', { exact: true })).toBeVisible()
      await expect(host.getByText('return', { exact: true })).toBeVisible()
      await expect(host.getByText('retornar', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: evidence('03-en-limpar-depois-de-executar') })
    })
  })

  test.describe('browser in Spanish (es-MX)', () => {
    test.use({ locale: 'es-MX' })

    test('a cleared root stays in Spanish after a run', async ({ page }) => {
      const host = page.getByTestId('blockly-workspace')

      await openWith(page, somaDosPares)
      await runExamples(page)

      // 04 — `devolver`, not the pt `retornar`.
      await clearBlocks(page)
      await expect(host.getByText('resolver', { exact: true })).toBeVisible()
      await expect(host.getByText('devolver', { exact: true })).toBeVisible()
      await expect(host.getByText('retornar', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: evidence('04-es-limpar-depois-de-executar') })
    })

    test('the refusal of a run is in Spanish', async ({ page }) => {
      await openWith(page, raizDesabilitada)
      await page.getByTestId('problem-run-button').click()

      // 05 — the codegen error is localized with the UI's locale.
      await expect(page.getByTestId('problem-results-invalid')).toHaveText(
        'Hay un bloque deshabilitado en tu solución. Reactívalo para continuar.',
      )
      await page.screenshot({ path: evidence('05-es-mensagem-de-recusa') })
    })
  })

  test.describe('browser in Portuguese (pt-BR)', () => {
    test.use({ locale: 'pt-BR' })

    test('a cleared root is still in Portuguese after a run', async ({ page }) => {
      const host = page.getByTestId('blockly-workspace')

      await openWith(page, somaDosPares)
      await runExamples(page)

      // 06 — no regression: pt stays pt.
      await clearBlocks(page)
      await expect(host.getByText('resolver', { exact: true })).toBeVisible()
      await expect(host.getByText('retornar', { exact: true })).toBeVisible()
      await page.screenshot({ path: evidence('06-pt-sem-regressao') })
    })
  })
})
