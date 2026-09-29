import { INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from '@kumite/blocks'
import { expect, type Locator, type Page, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  BACK_URL,
  type SeededParticipant,
  seedParticipant,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual walkthrough for #212 — "Ver como se resolve" on a practice problem.
// The participant has **no team** and nothing here opens a round: the demo is
// practice-only and must not touch the round lock other specs share. The
// problem is the `db:seed` plant "Soma da lista" (#210), found through the
// API rather than hardcoded.
const evidence = (name: string) => `e2e/evidence/212/${name}.png`

const SOMA_DA_LISTA = 'Soma da lista'
// The reference solution's blocks (blocks/src/fixtures/pratica-soma-lista.ts).
const SOLUTION_BLOCKS = 10
const STEPS = 8

/** Finds a seeded practice problem by its pt title. */
async function practiceProblemId(token: string, title: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/practice/problems?locale=pt`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status !== 200) throw new Error(`GET /practice/problems answered ${res.status}`)
  const list = (await res.json()) as { id: string; title: string }[]
  const found = list.find((problem) => problem.title === title)
  if (!found) {
    throw new Error(`no "${title}" — run \`pnpm --filter @kumite/back db:seed\` (#210) first`)
  }
  return found.id
}

/** What the participant had built before opening the demo: a half solution
 * plus a stray block, so a wrong restore cannot pass by accident. */
const participantWork = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'kumiteSolveRoot',
        x: 40,
        y: 40,
        inputs: { RETURN: { block: { type: INPUT_BLOCK_TYPE, id: 'entradaDoAluno' } } },
      },
      { type: 'math_number', id: 'blocoDoAluno', x: 260, y: 200, fields: { NUM: 7 } },
    ],
  },
}

/**
 * Every block on a canvas by id, and where each top-level one sits. A nested
 * block's offset follows its parent's label width, which moves with font
 * loading and a language round-trip — not with the restore — so only the ids
 * of nested blocks are compared. The exact serialization is the unit test's
 * job (practice.$id.test.tsx).
 */
async function blocksOn(canvas: Locator) {
  const ids = await canvas
    .locator('[data-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id') ?? '').sort())
  const placed = await canvas
    .locator('.blocklyBlockCanvas > [data-id]')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [node.getAttribute('data-id') ?? '', node.getAttribute('transform')]),
      ),
    )
  return { ids, placed }
}

async function savedWorkspace(page: Page, key: string): Promise<string | null> {
  return page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key)
}

test.describe('the practice demo (#212)', () => {
  let aluno: SeededParticipant
  let problemId: string

  test.beforeAll(async () => {
    aluno = await seedParticipant('Demo Aluno', 'Aluno Demo')
    problemId = await practiceProblemId(aluno.token, SOMA_DA_LISTA)
  })

  test('builds the solution step by step, read-only, and gives the editor back intact', async ({
    page,
  }) => {
    test.setTimeout(EDITOR_TEST_TIMEOUT_MS)
    const key = workspaceStorageKey(aluno.id, problemId)
    await seedParticipantToken(page, aluno.token)
    await page.addInitScript(
      ([storageKey, saved]) => window.localStorage.setItem(storageKey as string, saved as string),
      [key, JSON.stringify(participantWork)],
    )

    const editor = page.getByTestId('blockly-workspace')
    const demo = page.getByTestId('practice-demo-canvas')
    const position = page.getByTestId('practice-demo-position')
    const stepText = page.getByTestId('practice-demo-step-text')
    const prev = page.getByTestId('practice-demo-prev')
    const next = page.getByTestId('practice-demo-next')

    // 01 — the participant's own blocks, and the way into the demo.
    await page.goto(`/practice/${problemId}`)
    await expectBlocklyInjected(page)
    await expect(editor.locator('[data-id="blocoDoAluno"]')).toBeVisible()
    const before = await blocksOn(editor)
    expect(Object.keys(before.placed).sort()).toEqual(['blocoDoAluno', 'kumiteSolveRoot'])
    expect(before.ids).toContain('entradaDoAluno')
    const savedBefore = await savedWorkspace(page, key)
    expect(savedBefore).not.toBeNull()
    await expect(page.getByTestId('practice-demo-start')).toHaveText('Ver como se resolve')
    await page.screenshot({ path: evidence('01-botao-ver-como-se-resolve') })

    // 02 — step 1: only the root, Anterior disabled, Executar and Limpar gone,
    // and a canvas with no toolbox.
    await page.getByTestId('practice-demo-start').click()
    await expect(demo).toBeVisible()
    await expect(position).toHaveText(`Passo 1 de ${STEPS}`)
    await expect(stepText).toContainText('resolver')
    await expect(prev).toBeDisabled()
    await expect(next).toBeEnabled()
    await expect(page.getByTestId('problem-run-button')).toHaveCount(0)
    await expect(page.getByTestId('problem-clear-button')).toHaveCount(0)
    await expect(demo.locator('.blocklyToolbox')).toHaveCount(0)
    await expect(demo.locator('[data-id]')).toHaveCount(1)
    await page.screenshot({ path: evidence('02-passo-1-desktop') })

    // Read-only: dragging the root does not move it.
    const root = demo.locator('[data-id="raiz"]')
    const rootTransform = await root.getAttribute('transform')
    const box = await root.boundingBox()
    if (!box) throw new Error('the demo root has no box')
    await page.mouse.move(box.x + 20, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + 160, box.y + 120, { steps: 8 })
    await page.mouse.up()
    await expect(root).toHaveAttribute('transform', rootTransform ?? '')

    // 03 — step 4: the loop has entered.
    for (let i = 0; i < 3; i++) await next.click()
    await expect(position).toHaveText(`Passo 4 de ${STEPS}`)
    await expect(demo.locator('[data-id="paraCada"]')).toBeVisible()
    await page.screenshot({ path: evidence('03-passo-4-desktop') })

    // 04 — switching to English keeps step 4 and translates its sentence.
    await page.getByTestId('language-option-en').click()
    await expect(position).toHaveText(`Step 4 of ${STEPS}`)
    await expect(stepText).toContainText('In Loops')
    await expect(demo.locator('[data-id="paraCada"]')).toBeVisible()
    await page.screenshot({ path: evidence('04-passo-4-em-ingles') })

    // 05 — the last step is the whole reference solution; Próximo disabled.
    for (let i = 4; i < STEPS; i++) await next.click()
    await expect(position).toHaveText(`Step ${STEPS} of ${STEPS}`)
    await expect(next).toBeDisabled()
    await expect(prev).toBeEnabled()
    await expect(demo.locator('[data-id]')).toHaveCount(SOLUTION_BLOCKS)
    await page.screenshot({ path: evidence('05-passo-8-solucao-completa') })
    // The demo never wrote the participant's autosave.
    expect(await savedWorkspace(page, key)).toBe(savedBefore)

    // 06 — back to Portuguese (a nested block's place depends on its parent's
    // label width, so the comparison runs in the locale it was taken in), then
    // out of the demo: the editor as it was, same blocks in the same places,
    // and the autosave untouched.
    await page.getByTestId('language-option-pt').click()
    await expect(position).toHaveText(`Passo ${STEPS} de ${STEPS}`)
    await page.getByTestId('practice-demo-exit').click()
    await expect(demo).toHaveCount(0)
    await expect(page.getByTestId('problem-run-button')).toBeVisible()
    await expect(editor.locator('[data-id="blocoDoAluno"]')).toBeVisible()
    expect(await blocksOn(editor)).toEqual(before)
    expect(await savedWorkspace(page, key)).toBe(savedBefore)
    await page.screenshot({ path: evidence('06-editor-restaurado') })
  })

  test('fits a phone', async ({ page }) => {
    test.setTimeout(EDITOR_TEST_TIMEOUT_MS)
    await page.setViewportSize({ width: 390, height: 844 })
    await seedParticipantToken(page, aluno.token)

    // 07 — step 2 on a phone: controls reachable, no horizontal scroll.
    await page.goto(`/practice/${problemId}`)
    await expectBlocklyInjected(page)
    await page.getByTestId('practice-demo-start').click()
    await page.getByTestId('practice-demo-next').click()
    await expect(page.getByTestId('practice-demo-position')).toHaveText(`Passo 2 de ${STEPS}`)
    await expect(page.getByTestId('practice-demo-exit')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: evidence('07-passo-2-celular') })
  })
})
