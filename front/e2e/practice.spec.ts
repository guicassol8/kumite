import { INPUT_BLOCK_TYPE, ROOT_BLOCK_TYPE } from '@kumite/blocks'
import { expect, type Page, test } from '@playwright/test'

import {
  dragBlockFromFlyout,
  EDITOR_TEST_TIMEOUT_MS,
  editorTestTimeout,
  expectBlocklyInjected,
} from './support/blockly'
import {
  BACK_URL,
  PARTICIPANT_PASSWORD,
  type SeededParticipant,
  seedParticipant,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'

// Visual walkthrough for #211 — the practice tab. Every account here is a
// participant **without a team**, and nothing opens a round: practice has to
// work with neither. The problems are the three `db:seed` plants (#210), read
// back from the API as the oracle rather than hardcoded.
const evidence = (name: string) => `e2e/evidence/211/${name}.png`

type PracticeSummary = { id: string; title: string; difficulty: 'easy' | 'medium' | 'hard' }

const DIFFICULTY_PT = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' } as const

/** `GET /practice/problems` as this participant sees it — the spec's oracle. */
async function practiceCatalog(token: string): Promise<PracticeSummary[]> {
  const res = await fetch(`${BACK_URL}/practice/problems?locale=pt`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status !== 200) throw new Error(`GET /practice/problems answered ${res.status}`)
  const list = (await res.json()) as PracticeSummary[]
  if (list.length === 0) {
    throw new Error('no practice problems — run `pnpm --filter @kumite/back db:seed` (#210) first')
  }
  return list
}

/** `GET /problems/:id` — how many visible examples the run must report. */
async function exampleCount(token: string, problemId: string): Promise<number> {
  const res = await fetch(`${BACK_URL}/problems/${problemId}?locale=pt`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = (await res.json()) as { examples: unknown[] }
  return body.examples.length
}

/** root → retornar(entrada): the smallest workspace that runs at all. */
const returnInput = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'kumiteSolveRoot',
        x: 40,
        y: 40,
        inputs: { RETURN: { block: { type: INPUT_BLOCK_TYPE, id: 'entrada' } } },
      },
    ],
  },
}

async function submitLogin(page: Page, account: SeededParticipant, name: string) {
  await page.getByTestId('login-email-input').fill(account.email)
  await page.getByTestId('login-password-input').fill(PARTICIPANT_PASSWORD)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(name)
}

async function logoutThroughUi(page: Page) {
  await page.getByTestId('header-logout-button').click()
  await expect(page.getByTestId('header-login-link')).toBeVisible()
}

/** Page width never exceeds the viewport — no horizontal scroll. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('the practice tab (#211)', () => {
  let catalog: PracticeSummary[]
  let aluno: SeededParticipant

  test.beforeAll(async () => {
    aluno = await seedParticipant('Pratica Aluno', 'Aluno Prática')
    catalog = await practiceCatalog(aluno.token)
  })

  test('the header leads to the list, and a problem opens without anything of a round', async ({
    page,
  }) => {
    test.setTimeout(EDITOR_TEST_TIMEOUT_MS)
    await seedParticipantToken(page, aluno.token)

    // 01 — from the header, with no team and no round: every practice problem
    // with its title and difficulty.
    await page.goto('/')
    await page.getByTestId('header-practice-link').click()
    await expect(page).toHaveURL(/\/practice$/)
    const list = page.getByTestId('practice-list')
    await expect(list).toBeVisible()
    // Every id of the oracle, not an exact count: the database is shared, and
    // other specs (organizer-round-form-practice) add practice problems of
    // their own while this one runs.
    for (const problem of catalog) {
      await expect(page.getByTestId(`practice-problem-link-${problem.id}`)).toHaveText(
        problem.title,
      )
      await expect(page.getByTestId(`practice-problem-difficulty-${problem.id}`)).toHaveText(
        DIFFICULTY_PT[problem.difficulty],
      )
    }
    await page.screenshot({ path: evidence('01-lista-pratica'), fullPage: true })

    // 02 — the first one: statement, examples, editor and Executar; no
    // Submeter, no points, no best score.
    const first = catalog[0] as PracticeSummary
    await page.getByTestId(`practice-problem-link-${first.id}`).click()
    await expect(page).toHaveURL(new RegExp(`/practice/${first.id}$`))
    await expectBlocklyInjected(page)
    await expect(page.getByTestId('problem-statement-body')).toBeVisible()
    await expect(page.getByTestId('problem-example-0')).toBeVisible()
    await expect(page.getByTestId('problem-run-button')).toBeVisible()
    for (const testId of [
      'problem-submit-button',
      'problem-points-badge',
      'problem-best-score-badge',
      'problem-no-submission-badge',
      'problem-position-badge',
      'problem-closed-notice',
    ]) {
      await expect(page.getByTestId(testId)).toHaveCount(0)
    }
    await page.screenshot({ path: evidence('02-problema-pratica') })
  })

  test('Executar runs the solution against every visible example', async ({ page }) => {
    test.setTimeout(EDITOR_TEST_TIMEOUT_MS)
    const first = catalog[0] as PracticeSummary
    const examples = await exampleCount(aluno.token, first.id)
    await seedParticipantToken(page, aluno.token)
    await page.addInitScript(
      ([key, saved]) => window.localStorage.setItem(key as string, saved as string),
      [workspaceStorageKey(aluno.id, first.id), JSON.stringify(returnInput)],
    )

    // 03 — one result per visible example, and the summary over them.
    await page.goto(`/practice/${first.id}`)
    await expectBlocklyInjected(page)
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-panel')).toBeVisible()
    // Settled, not mid-run: Executar is back and the summary counts them all.
    await expect(page.getByTestId('problem-run-button')).toBeEnabled()
    await expect(page.getByTestId('problem-results-summary')).toHaveText(
      new RegExp(`^\\d+/${examples} casos$`),
    )
    for (let index = 0; index < examples; index++) {
      await expect(page.getByTestId(`problem-result-${index}`)).toBeVisible()
    }
    await expect(page.getByTestId(`problem-result-${examples}`)).toHaveCount(0)
    await page.screenshot({ path: evidence('03-executar-resultados') })
  })

  test('the workspace is restored on return, and a logout keeps it from the next account', async ({
    page,
  }) => {
    // Four editor mounts: build, return, the second account, the owner again.
    test.setTimeout(editorTestTimeout(4))
    // Real logins through the form: a seeded token would be re-injected on
    // every navigation and undo the logout (same reason as #175's spec).
    const dono = await seedParticipant('Pratica Dono', 'Dono')
    const outro = await seedParticipant('Pratica Outro', 'Outro')
    const problem = catalog[catalog.length - 1] as PracticeSummary
    const host = page.getByTestId('blockly-workspace')
    const blocks = host.locator('g.blocklyDraggable:visible')

    await page.goto('/login')
    await submitLogin(page, dono, 'Dono')
    await page.getByTestId('header-practice-link').click()
    await page.getByTestId(`practice-problem-link-${problem.id}`).click()
    await expectBlocklyInjected(page)
    await expect(blocks).toHaveCount(1)
    await dragBlockFromFlyout(page, 'Matemática')
    await expect(blocks).toHaveCount(2)
    // The auto-save is debounced.
    await page.waitForTimeout(600)

    // 04 — leave for the list and come back: the block is still there.
    await page.getByTestId('header-practice-link').click()
    await expect(page.getByTestId('practice-list')).toBeVisible()
    await page.getByTestId(`practice-problem-link-${problem.id}`).click()
    await expectBlocklyInjected(page)
    await expect(blocks).toHaveCount(2)
    await page.screenshot({ path: evidence('04-workspace-restaurado') })

    // 05 — logout; the next account on the same browser opens the same
    // problem and sees only the root block (#175's rule).
    await logoutThroughUi(page)
    await page.getByTestId('header-login-link').click()
    await submitLogin(page, outro, 'Outro')
    await page.goto(`/practice/${problem.id}`)
    await expectBlocklyInjected(page)
    await expect(blocks).toHaveCount(1)
    await page.screenshot({ path: evidence('05-outro-usuario-canvas-vazio') })

    // 06 — the owner signs back in and gets the blocks back.
    await logoutThroughUi(page)
    await page.getByTestId('header-login-link').click()
    await submitLogin(page, dono, 'Dono')
    await page.goto(`/practice/${problem.id}`)
    await expectBlocklyInjected(page)
    await expect(blocks).toHaveCount(2)
    await page.screenshot({ path: evidence('06-dono-recupera') })
  })

  test('an empty catalog says so instead of a blank screen', async ({ page }) => {
    await seedParticipantToken(page, aluno.token)
    await page.route(`${BACK_URL}/practice/problems*`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )

    // 07
    await page.goto('/practice')
    await expect(page.getByTestId('practice-empty')).toHaveText(
      'Ainda não há problemas de prática disponíveis.',
    )
    await expect(page.getByTestId('practice-list')).toHaveCount(0)
    await page.screenshot({ path: evidence('07-lista-vazia') })
  })

  test('an anonymous visitor is sent to the login', async ({ page }) => {
    // 08
    await page.goto('/practice')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await expect(page.getByTestId('login-email-input')).toBeVisible()
    await page.screenshot({ path: evidence('08-redireciona-login') })
  })

  test('on a phone the list fits and Prática is in the menu panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedParticipantToken(page, aluno.token)

    // 09 — the list without horizontal scroll, then the panel's own entry.
    await page.goto('/practice')
    await expect(page.getByTestId('practice-list')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByTestId('header-mobile-menu-trigger').click()
    const panelLink = page.getByTestId('header-practice-link').filter({ visible: true })
    await expect(panelLink).toHaveCount(1)
    await expect(panelLink).toHaveAttribute('href', '/practice')
    await page.screenshot({ path: evidence('09-celular-menu') })
    await panelLink.click()
    await expect(page.getByTestId('header-mobile-user-block')).toHaveCount(0)
  })
})
