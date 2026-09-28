import type { Page } from '@playwright/test'
import {
  BACK_URL,
  createRound,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual evidence for #347: the round/practice visibility control on the
// organizer's problem form, the "Prática" badge on the list, and the two PATCH
// refusals a visibility change can earn. Needs ORGANIZER_EMAIL/
// ORGANIZER_PASSWORD, like every organizer spec, plus `db:seed`.
const evidence = (name: string) => `e2e/evidence/347/${name}.png`

// Stamped titles: the database outlives the run, so a plain title would match
// an earlier run's problem too.
const stamp = Date.now()

type Case = { input: unknown; expected: unknown; hidden: boolean }

const VISIBLE_ONLY: Case[] = [{ input: [1, 2], expected: 3, hidden: false }]
const VISIBLE_AND_HIDDEN: Case[] = [...VISIBLE_ONLY, { input: [4, 5], expected: 9, hidden: true }]

async function seedPublishedProblem(
  title: string,
  visibility: 'round' | 'practice',
  testCases: Case[],
): Promise<string> {
  const auth = await organizerAuthHeader()
  const created = await fetch(`${BACK_URL}/organizer/problems`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ difficulty: 'easy', points: 10, visibility }),
  })
  expect(created.status).toBe(201)
  const { id } = (await created.json()) as { id: string }
  const patched = await fetch(`${BACK_URL}/organizer/problems/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({
      testCases,
      translations: [
        { locale: 'pt', title, statementMd: `Resolva ${title}.` },
        { locale: 'es', title, statementMd: `Resuelve ${title}.` },
        { locale: 'en', title, statementMd: `Solve ${title}.` },
      ],
    }),
  })
  expect(patched.status).toBe(200)
  const published = await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, {
    method: 'POST',
    headers: auth,
  })
  expect(published.status).toBe(200)
  return id
}

async function readVisibility(id: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/organizer/problems/${id}`, {
    headers: await organizerAuthHeader(),
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { visibility: string }).visibility
}

async function loginAsOrganizer(page: Page) {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
  await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
}

async function chooseVisibility(page: Page, visibility: 'round' | 'practice') {
  await page.getByTestId('problem-form-visibility').click()
  await page.getByTestId(`problem-form-visibility-${visibility}`).click()
}

async function fillAllLocales(page: Page, title: string) {
  for (const locale of ['pt', 'es', 'en'] as const) {
    await page.getByTestId(`problem-form-tab-${locale}`).click()
    await page.getByTestId(`problem-form-title-${locale}`).fill(`${title} ${locale}`)
    await page.getByTestId(`problem-form-statement-${locale}`).fill(`Some a e b (${locale}).`)
  }
}

function problemIdFromEditUrl(page: Page): string {
  return new URL(page.url()).pathname.split('/').at(-2) as string
}

test.describe('organizer problem visibility (#347)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('creates a practice problem with one visible case and badges it on the list', async ({
    page,
  }) => {
    await loginAsOrganizer(page)

    // 01 — choosing Prática on the create form explains that hidden cases are
    // neither required nor used.
    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form-visibility')).toHaveText('Rodada')
    await chooseVisibility(page, 'practice')
    await expect(page.getByTestId('problem-form-visibility')).toHaveText('Prática')
    await expect(page.getByTestId('problem-form-practice-note')).toContainText(
      'os casos ocultos não são exigidos nem usados',
    )

    const title = `Prática criada ${stamp}`
    await fillAllLocales(page, title)
    await page.getByTestId('problem-form-add-case').click()
    await page.getByTestId('problem-form-case-0-input').fill('[1, 2]')
    await page.getByTestId('problem-form-case-0-expected').fill('3')
    await page.screenshot({ path: evidence('01-new-practice-note'), fullPage: true })

    // 02 — one visible case is enough to publish; the list marks the row as
    // practice, next to its state.
    const created = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url() === `${BACK_URL}/organizer/problems`,
    )
    await page.getByTestId('problem-form-publish').click()
    const createdBody = (await (await created).request().postDataJSON()) as { visibility: string }
    expect(createdBody.visibility).toBe('practice')
    const { id } = (await (await created).json()) as { id: string }

    await expect(page).toHaveURL(/\/organizer\/problems$/)
    const row = page.getByTestId(`organizer-problems-row-${id}`)
    await expect(row).toContainText('Publicado')
    await expect(page.getByTestId(`organizer-problems-visibility-${id}`)).toHaveText('Prática')
    await row.scrollIntoViewIfNeeded()
    await page.screenshot({ path: evidence('02-list-practice-badge'), fullPage: true })
    expect(await readVisibility(id)).toBe('practice')
  })

  test('creates a round problem when the control is left alone', async ({ page }) => {
    await loginAsOrganizer(page)

    await page.goto('/organizer/problems/new')
    await page.getByTestId('problem-form-title-pt').fill(`Rodada default ${stamp}`)
    await page.getByTestId('problem-form-statement-pt').fill('Some a e b.')
    await page.getByTestId('problem-form-save').click()

    await expect(page).toHaveURL(/\/organizer\/problems\/[^/]+\/edit$/)
    const id = problemIdFromEditUrl(page)
    expect(await readVisibility(id)).toBe('round')
    await expect(page.getByTestId('problem-form-visibility')).toHaveText('Rodada')

    await page.goto('/organizer/problems')
    await expect(page.getByTestId(`organizer-problems-row-${id}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-problems-visibility-${id}`)).toHaveCount(0)
  })

  test('refuses practice for a problem already in a round, keeping what was typed', async ({
    page,
  }) => {
    // A draft round is enough: the back refuses once the problem has any row
    // in round_problems, open or not — so no round slot is taken here.
    const id = await seedPublishedProblem(`Em rodada ${stamp}`, 'round', VISIBLE_AND_HIDDEN)
    await createRound(await organizerAuthHeader(), {
      name: `Rodada rascunho ${stamp}`,
      durationMinutes: 30,
      problemIds: [id],
    })
    await loginAsOrganizer(page)

    await page.goto(`/organizer/problems/${id}/edit`)
    await expect(page.getByTestId('problem-form-visibility')).toHaveText('Rodada')
    await chooseVisibility(page, 'practice')
    const edited = 'Enunciado revisado que não pode se perder.'
    await page.getByTestId('problem-form-statement-pt').fill(edited)
    await page.getByTestId('problem-form-save').click()

    // 03 — the refusal sits under the Select; the typed statement and the
    // chosen option survive, and no generic "could not save" appears.
    await expect(page.getByTestId('problem-form-visibility-error')).toHaveText(
      'Este problema já esteve numa rodada e não pode virar prática.',
    )
    await expect(page.getByTestId('problem-form-error')).toHaveCount(0)
    await expect(page.getByTestId('problem-form-statement-pt')).toHaveValue(edited)
    await expect(page.getByTestId('problem-form-visibility')).toHaveText('Prática')
    await page.screenshot({ path: evidence('03-problem-in-round'), fullPage: true })
    expect(await readVisibility(id)).toBe('round')
  })

  test('refuses going back to round for a published practice problem with no hidden case', async ({
    page,
  }) => {
    const id = await seedPublishedProblem(`Prática sem oculto ${stamp}`, 'practice', VISIBLE_ONLY)
    await loginAsOrganizer(page)

    await page.goto(`/organizer/problems/${id}/edit`)
    await expect(page.getByTestId('problem-form-visibility')).toHaveText('Prática')
    await chooseVisibility(page, 'round')
    await page.getByTestId('problem-form-save').click()

    // 04 — the refusal lands on the test-case section, where the fix is.
    await expect(page.getByTestId('problem-form-cases-error')).toHaveText(
      'Para voltar para rodada, um problema publicado precisa de pelo menos um caso visível e um oculto.',
    )
    await expect(page.getByTestId('problem-form-error')).toHaveCount(0)
    await page.getByTestId('problem-form-cases-error').scrollIntoViewIfNeeded()
    await page.screenshot({ path: evidence('04-missing-test-cases'), fullPage: true })
    expect(await readVisibility(id)).toBe('practice')
  })

  for (const { locale, lang, practice, note, shot } of [
    {
      locale: 'es-MX',
      lang: 'es',
      practice: 'Práctica',
      note: 'los casos ocultos no se exigen ni se usan',
      shot: '05-es-form',
    },
    {
      locale: 'en-US',
      lang: 'en',
      practice: 'Practice',
      note: 'hidden cases are neither required nor used',
      shot: '06-en-form',
    },
  ]) {
    test.describe(`in ${lang}`, () => {
      test.use({ locale })

      test('shows the control, the note and the badge translated', async ({ page }) => {
        const id = await seedPublishedProblem(`Practice ${lang} ${stamp}`, 'practice', VISIBLE_ONLY)
        await loginAsOrganizer(page)

        await page.goto('/organizer/problems/new')
        await chooseVisibility(page, 'practice')
        await expect(page.getByTestId('problem-form-visibility')).toHaveText(practice)
        await expect(page.getByTestId('problem-form-practice-note')).toContainText(note)
        await page.screenshot({ path: evidence(shot), fullPage: true })

        await page.goto('/organizer/problems')
        await expect(page.getByTestId(`organizer-problems-visibility-${id}`)).toHaveText(practice)
      })
    })
  }
})
