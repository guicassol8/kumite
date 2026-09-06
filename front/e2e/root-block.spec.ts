import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #4: the protected root block, the pt-br locale of the
// native Blockly blocks and the Variables category that can create variables.
// #7 moved the editor behind a real problem id — this suite only needs to
// *view* one, so `beforeAll` seeds a problem+round once (opened then
// immediately closed, so it never holds the single-open-round slot) and every
// test signs in via a seeded token instead of the UI.
const evidence = (name: string) => `e2e/evidence/4/${name}.png`

const ROOT = '[data-id="kumiteSolveRoot"]'

const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const PASSWORD = 'supersecret'

function contextMenu(page: Page) {
  return page.locator('.blocklyContextMenu')
}

// The root block is a C shape: the centre of its bounding box is the hole in
// the middle, where the canvas background swallows the click. Its label is
// solid ground.
function rootLabel(page: Page) {
  return page.locator(ROOT).getByText('resolver')
}

async function dragBlockFromCategory(page: Page, category: string) {
  await page.locator('.blocklyToolbox').getByRole('treeitem', { name: category }).click()
  const flyoutBlock = page.locator('.blocklyFlyout g.blocklyDraggable').first()
  await expect(flyoutBlock).toBeVisible()
  const source = await flyoutBlock.boundingBox()
  const canvas = await page.getByTestId('blockly-workspace').boundingBox()
  if (!source || !canvas) throw new Error('the flyout block or the canvas has no box')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width * 0.65, canvas.y + canvas.height * 0.7, {
    steps: 12,
  })
  await page.mouse.up()
}

test.describe('the root block and native blocks (#4)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    const orgLogin = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
    })
    const { token: orgToken } = (await orgLogin.json()) as { token: string }
    const auth = { authorization: `Bearer ${orgToken}` }

    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    const { id } = (await created.json()) as { id: string }
    problemId = id
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: 'Soma dos Pares', statementMd: 'Some os números pares.' },
          { locale: 'es', title: 'Suma de Pares', statementMd: 'Suma los números pares.' },
          { locale: 'en', title: 'Sum of Evens', statementMd: 'Sum the even numbers.' },
        ],
        testCases: [
          { input: [1, 2, 3, 4], expected: 6, hidden: false },
          { input: [5, 7, 9], expected: 0, hidden: false },
          { input: [2, 4, 6, 8], expected: 20, hidden: false },
          { input: [10, 11, 12], expected: 22, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })

    const roundRes = await fetch(`${BACK_URL}/organizer/rounds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        name: `Root Block E2E ${Date.now()}`,
        durationMinutes: 30,
        problemIds: [id],
      }),
    })
    const { id: roundId } = (await roundRes.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/rounds/${roundId}/open`, { method: 'POST', headers: auth })
    await fetch(`${BACK_URL}/organizer/rounds/${roundId}/close`, { method: 'POST', headers: auth })

    const participantEmail = `root-block-e2e-${Date.now()}@edu.pucrs.br`
    await fetch(`${BACK_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: participantEmail, password: PASSWORD, code: 'PUCRS2026' }),
    })
    const participantLogin = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: participantEmail, password: PASSWORD }),
    })
    const { token } = (await participantLogin.json()) as { token: string }
    participantToken = token
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([key, token]) => window.localStorage.setItem(key as string, token as string),
      ['kumite-token', participantToken],
    )
  })

  test('the native blocks speak pt-br and the root block cannot be deleted or duplicated', async ({
    page,
  }) => {
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyFlyout')

    // 01 — the native Blockly blocks are translated by the official locale pack:
    // "repita … vezes", not "repeat … times".
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()
    await toolbox.getByRole('treeitem', { name: 'Laços' }).click()
    await expect(flyout.getByText('repita').first()).toBeVisible()
    await expect(flyout.getByText('vezes').first()).toBeVisible()
    await expect(flyout.getByText('para cada item').first()).toBeVisible()
    await page.screenshot({ path: evidence('01-blocos-nativos-pt-br') })

    // 02 — the root block's context menu offers neither "Deletar bloco" nor
    // "Duplicar".
    await page.keyboard.press('Escape')
    await rootLabel(page).click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    await expect(contextMenu(page).getByText('Deletar bloco')).toHaveCount(0)
    await expect(contextMenu(page).getByText('Duplicar')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-menu-raiz-protegido') })

    // 03 — a block dragged from the toolbox still offers both: the protection is
    // the root block's, not a global lockdown of the editor.
    await page.keyboard.press('Escape')
    await dragBlockFromCategory(page, 'Matemática')
    const dragged = page
      .getByTestId('blockly-workspace')
      .locator(`g.blocklyDraggable:visible:not(${ROOT})`)
      .first()
    await expect(dragged).toBeVisible()
    await dragged.click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    await expect(contextMenu(page).getByText('Deletar bloco')).toBeVisible()
    await expect(contextMenu(page).getByText('Duplicar')).toBeVisible()
    await page.screenshot({ path: evidence('03-menu-bloco-comum') })

    // 04 — selecting the root and pressing Delete leaves it exactly where it was.
    await page.keyboard.press('Escape')
    await rootLabel(page).click()
    await expect(page.locator(`${ROOT}.blocklySelected`)).toHaveCount(1)
    await page.keyboard.press('Delete')
    await expect(page.locator(ROOT)).toHaveCount(1)
    await expect(rootLabel(page)).toBeVisible()
    await page.screenshot({ path: evidence('04-raiz-sobrevive-delete') })
  })

  test('the Variables category can create more than one variable', async ({ page }) => {
    const toolbox = page.locator('.blocklyToolbox')
    const flyout = page.locator('.blocklyFlyout')

    // 05 — "Criar variável..." exists (the static category Blockly would build
    // has no such button), and both variables end up offered in the flyout.
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()

    // Clicking a category toggles its flyout, so the category is opened once and
    // both variables are created from the flyout that stays open — which is also
    // what proves it rebuilds itself after each new variable.
    await toolbox.getByRole('treeitem', { name: 'Variáveis' }).click()

    for (const name of ['soma', 'numero']) {
      const createButton = flyout.locator('.blocklyFlyoutButton').getByText('Criar variável...')
      await expect(createButton).toBeVisible()
      await createButton.click()

      // Blockly 13 prompts through its own <dialog>, not window.prompt.
      const dialog = page.locator('dialog.blocklyDialog')
      await expect(dialog).toBeVisible()
      await dialog.locator('.blocklyDialogInput').fill(name)
      await dialog.locator('.blocklyDialogConfirmButton').click()
      await expect(dialog).toBeHidden()
    }

    await expect(flyout.getByText('soma', { exact: true }).first()).toBeVisible()
    await expect(flyout.getByText('numero', { exact: true }).first()).toBeVisible()
    await expect(flyout.getByText('entrada', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: evidence('05-criar-variavel') })
  })

  test('a saved workspace that lost the root block gets it back with its blocks', async ({
    page,
  }) => {
    // 06 — localStorage seeded with a state that has no root block: the screen
    // re-seeds the root and keeps what was saved, instead of stranding the
    // participant with a workspace the toolbox cannot rebuild.
    await page.addInitScript(
      ([key, state]) => {
        window.localStorage.setItem(key as string, state as string)
      },
      [
        `kumite:workspace:${problemId}`,
        JSON.stringify({
          blocks: {
            languageVersion: 0,
            blocks: [
              { type: 'math_number', id: 'salvoSemRaiz', x: 260, y: 60, fields: { NUM: 42 } },
            ],
          },
        }),
      ],
    )

    await page.goto(`/problem/${problemId}`)
    const host = page.getByTestId('blockly-workspace')

    await expect(host.locator('svg.blocklySvg')).toBeVisible()
    await expect(page.locator(ROOT)).toHaveCount(1)
    await expect(page.locator('[data-id="salvoSemRaiz"]')).toHaveCount(1)
    await expect(host.getByText('42')).toBeVisible()
    await page.screenshot({ path: evidence('06-restore-sem-raiz') })
  })
})
