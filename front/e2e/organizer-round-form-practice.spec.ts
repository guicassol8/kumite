import {
  BACK_URL,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual evidence for #209 (A4): the one front change of a back-first issue.
// A practice problem is published but never eligible for a round, so the round
// form's problem picker offers the published round problem and not the
// practice one. Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD, like every organizer
// spec, and a back migrated to 0025 (problems.visibility).
const evidence = (name: string) => `e2e/evidence/209/${name}.png`

// Stamped titles: the database outlives the run, so a plain title would match
// an earlier run's problem too.
const stamp = Date.now()

async function seedPublishedProblem(
  title: string,
  visibility: 'round' | 'practice',
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
      testCases: [
        { input: [1, 2], expected: 3, hidden: false },
        { input: [4, 5], expected: 9, hidden: true },
      ],
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

test.describe('round form problem picker (#209)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test('offers published round problems and never a published practice one', async ({ page }) => {
    const roundProblemId = await seedPublishedProblem(`Rodada ${stamp}`, 'round')
    const practiceProblemId = await seedPublishedProblem(`Prática ${stamp}`, 'practice')

    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)

    // 01 — both problems are published; the practice one shows in the
    // organizer's problem list, so its absence below is the filter, not a gap.
    await page.goto('/organizer/problems')
    await expect(page.getByText(`Prática ${stamp}`)).toBeVisible()
    await expect(page.getByText(`Rodada ${stamp}`)).toBeVisible()
    await page.screenshot({ path: evidence('01-both-published'), fullPage: true })

    // 02 — the new-round form offers the round problem and not the practice one.
    await page.goto('/organizer/rounds/new')
    await expect(page.getByTestId('round-form')).toBeVisible()
    const roundCheckbox = page.getByTestId(`round-form-problem-${roundProblemId}-checkbox`)
    await expect(roundCheckbox).toBeVisible()
    await expect(page.getByTestId(`round-form-problem-${practiceProblemId}`)).toHaveCount(0)
    await expect(page.getByTestId(`round-form-problem-${practiceProblemId}-checkbox`)).toHaveCount(
      0,
    )
    await expect(page.getByText(`Prática ${stamp}`)).toHaveCount(0)
    await roundCheckbox.scrollIntoViewIfNeeded()
    await page.screenshot({ path: evidence('02-picker-without-practice'), fullPage: true })
  })
})
