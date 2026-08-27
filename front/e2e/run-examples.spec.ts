import { emptyWorkspaceState, ROOT_BLOCK_TYPE, somaDosPares } from '@kumite/blocks'
import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #5, one screenshot per acceptance criterion.
const evidence = (name: string) => `e2e/evidence/5/${name}.png`

const STORAGE_KEY = 'kumite:workspace:soma-dos-pares'

/** Seeds the saved workspace, which is what the screen restores on mount. */
async function seedWorkspace(page: Page, state: unknown) {
  await page.addInitScript(
    ([key, saved]) => {
      window.localStorage.setItem(key as string, saved as string)
    },
    [STORAGE_KEY, JSON.stringify(state)],
  )
}

/**
 * The canonical solution with its `resto = 0` test flipped to `resto ≠ 0`, so
 * it sums the odd numbers. `EQ` appears once in the fixture — the other `OP` is
 * the `ADD` of the accumulator.
 */
const somaDosImpares = JSON.parse(JSON.stringify(somaDosPares).replace('"OP":"EQ"', '"OP":"NEQ"'))

/** `while (true) {}` — the JS generator plants no loop trap, so it really hangs. */
const infiniteLoop = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'kumiteSolveRoot',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'controls_whileUntil',
              id: 'enquanto',
              fields: { MODE: 'WHILE' },
              inputs: {
                BOOL: {
                  block: { type: 'logic_boolean', id: 'verdadeiro', fields: { BOOL: 'TRUE' } },
                },
              },
            },
          },
        },
      },
    ],
  },
}

/**
 * Emits `numero.shift()` over a number. A `math_number` cannot be plugged into
 * the list socket — Blockly's connection checker refuses it — but a variable
 * can, because variables are untyped, so the mistake survives to runtime.
 */
const removeFromNumber = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'kumiteSolveRoot',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'guardaNumero',
              fields: { VAR: { id: 'varNumero' } },
              inputs: {
                VALUE: { block: { type: 'math_number', id: 'sete', fields: { NUM: 7 } } },
              },
            },
          },
          RETURN: {
            block: {
              type: 'lists_getIndex',
              id: 'pegaERemove',
              fields: { MODE: 'GET_REMOVE', WHERE: 'FIRST' },
              inputs: {
                VALUE: {
                  block: {
                    type: 'variables_get',
                    id: 'leNumero',
                    fields: { VAR: { id: 'varNumero' } },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
  variables: [{ name: 'numero', id: 'varNumero' }],
}

async function runAndWait(page: Page) {
  await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()
  await page.getByTestId('problem-run-button').click()
  await expect(page.getByTestId('problem-results-panel')).toBeVisible()
}

test('every example passes when the solution is right', async ({ page }) => {
  await seedWorkspace(page, somaDosPares)
  await page.goto('/problem')

  // 01 — the three cases run and the header reports the overall success.
  await runAndWait(page)
  const summary = page.getByTestId('problem-results-summary')
  await expect(summary).toHaveText('3/3 casos')
  await expect(summary).toHaveAttribute('data-state', 'passed')
  for (const index of [0, 1, 2]) {
    await expect(page.getByTestId(`problem-result-${index}`)).toHaveAttribute(
      'data-status',
      'passed',
    )
  }
  await page.screenshot({ path: evidence('01-todos-passam') })
})

test('a wrong solution fails each case showing expected against obtained', async ({ page }) => {
  await seedWorkspace(page, somaDosImpares)
  await page.goto('/problem')

  // 02 — summing the odd numbers instead: every case is ✗ and says what it
  // expected and what it got.
  await runAndWait(page)
  for (const index of [0, 1, 2]) {
    await expect(page.getByTestId(`problem-result-${index}`)).toHaveAttribute(
      'data-status',
      'failed',
    )
  }
  const summary = page.getByTestId('problem-results-summary')
  await expect(summary).toHaveText('0/3 casos')
  await expect(summary).toHaveAttribute('data-state', 'failed')
  const first = page.getByTestId('problem-result-0')
  await expect(first).toContainText('esperado 6')
  await expect(first).toContainText('obtido 4')
  await page.screenshot({ path: evidence('02-caso-falha') })
})

test('an infinite loop is aborted by the timeout, case by case', async ({ page }) => {
  // Three cases × 2s of timeout, plus the page boot.
  test.setTimeout(60_000)
  await seedWorkspace(page, infiniteLoop)
  await page.goto('/problem')

  // 03 — the button is disabled while it runs, and each case comes back as a
  // timeout instead of hanging the tab.
  await runAndWait(page)
  await expect(page.getByTestId('problem-run-button')).toBeDisabled()
  for (const index of [0, 1, 2]) {
    await expect(page.getByTestId(`problem-result-${index}`)).toHaveAttribute(
      'data-status',
      'timeout',
      { timeout: 15_000 },
    )
  }
  await expect(page.getByTestId('problem-result-0')).toContainText('Tempo esgotado (2s)')
  await expect(page.getByTestId('problem-run-button')).toBeEnabled()
  await page.screenshot({ path: evidence('03-timeout') })
})

test('a solution that throws reports the error and keeps running the other cases', async ({
  page,
}) => {
  await seedWorkspace(page, removeFromNumber)
  await page.goto('/problem')

  // 04 — `numero.shift()` over a number throws on every case; the message shows
  // in the case that raised it and the run reaches the last one.
  await runAndWait(page)
  for (const index of [0, 1, 2]) {
    await expect(page.getByTestId(`problem-result-${index}`)).toHaveAttribute(
      'data-status',
      'error',
    )
  }
  await expect(page.getByTestId('problem-result-0')).toContainText('Erro:')
  await expect(page.getByTestId('problem-result-0')).toContainText('shift')
  await page.screenshot({ path: evidence('04-erro-runtime') })
})

test('an empty workspace gets a friendly warning instead of an error', async ({ page }) => {
  await seedWorkspace(page, emptyWorkspaceState)
  await page.goto('/problem')

  // 05 — nothing plugged into the root: a nudge on what to do, no case list and
  // no scary error.
  await runAndWait(page)
  await expect(page.getByTestId('problem-results-empty')).toHaveText(
    'Monte a sua solução dentro do bloco “resolver” e clique em Executar.',
  )
  await expect(page.getByTestId('problem-result-0')).toHaveCount(0)
  await expect(page.getByTestId('problem-results-summary')).toHaveCount(0)
  await page.screenshot({ path: evidence('05-workspace-vazio') })
})
