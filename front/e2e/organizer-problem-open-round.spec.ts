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

// Visual walkthrough for #193: editing a problem's test cases in the middle of
// an open round is refused, with a message that says why and what is still
// allowed — instead of the generic "Tente novamente", which would be a lie
// (retrying is exactly what does not work).
//
// Prereqs, like the other organizer specs: a migrated and seeded database plus
// ORGANIZER_EMAIL / ORGANIZER_PASSWORD in the environment. The single
// open-round slot is handled by `roundSlot`.
const evidence = (name: string) => `e2e/evidence/193/${name}.png`

const stamp = Date.now()

test.describe('problem in an open round (#193)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function apiCreatePublishedProblem(title: string): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title, statementMd: 'Some dois números.' },
          { locale: 'es', title, statementMd: 'Suma dos números.' },
          { locale: 'en', title, statementMd: 'Sum two numbers.' },
        ],
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [2, 2], expected: 4, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
  }

  test('refuses a test-case edit with a reason, and still saves the statement', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problemId = await apiCreatePublishedProblem(`Rodada Aberta E2E ${stamp}`)
    const roundId = await createRound(auth, {
      name: `Rodada Aberta E2E ${stamp}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    await roundSlot.open(auth, roundId)

    await loginAsOrganizer(page)

    // 01 — the edit form of a problem whose round is open, untouched.
    await page.goto(`/organizer/problems/${problemId}/edit`)
    await expect(page.getByTestId('problem-form')).toBeVisible()
    await expect(page.getByTestId('problem-form-case-1-expected')).toHaveValue('4')
    await page.screenshot({ path: evidence('01-edit-form-round-open'), fullPage: true })

    // 02 — changing the hidden case's expected value and saving is refused, in
    // the root banner, naming the reason and the way out.
    await page.getByTestId('problem-form-case-1-expected').fill('99')
    await page.getByTestId('problem-form-save').click()

    const banner = page.getByTestId('problem-form-error')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('rodada aberta')
    await expect(banner).not.toContainText('Tente novamente')
    await page.screenshot({ path: evidence('02-refused-with-reason'), fullPage: true })

    // 03 — the third acceptance criterion, from the organizer's side: with the
    // same round still open, fixing the statement saves normally.
    await page.reload()
    await expect(page.getByTestId('problem-form')).toBeVisible()
    // The refusal wrote nothing: the reloaded form shows the stored value.
    await expect(page.getByTestId('problem-form-case-1-expected')).toHaveValue('4')

    await page
      .getByTestId('problem-form-statement-pt')
      .fill('Some dois números e devolva o resultado.')
    await page.getByTestId('problem-form-save').click()

    await expect(page.getByTestId('problem-form-success')).toBeVisible()
    await page.screenshot({ path: evidence('03-statement-fix-allowed'), fullPage: true })
  })
})
