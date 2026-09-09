import type { Page } from '@playwright/test'

import {
  BACK_URL,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual walkthrough for #41. Prereqs (like organizer-problems.spec.ts):
//   docker compose up -d && pnpm db:migrate
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment.
const evidence = (name: string) => `e2e/evidence/41/${name}.png`
const evidence129 = (name: string) => `e2e/evidence/129/${name}.png`

// Both rounds carry a stamp: the plain names used to match every "Rodada A"
// left by an earlier run, so `getByText` hit a strict-mode violation on the
// second execution against the same database (#150).
const stamp = Date.now()
const roundAName = `Rodada A ${stamp}`
const roundBName = `Rodada B ${stamp}`

test.describe('organizer rounds', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
  }

  async function seedPublishedProblem(title: string): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy', points: 10 }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
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
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  test('walks through the round lifecycle: create, open (with the other disabled), extend, edit-blocked, close', async ({
    page,
    roundSlot,
  }) => {
    await loginAsOrganizer(page)
    const problemId = await seedPublishedProblem('Soma de dois números')

    // 01 — the empty state, stubbed. It used to rely on the round table being
    // genuinely empty, which is true exactly once per database (#150): every
    // later run, this one's own two rounds are still there. Scoped to the
    // back's origin, like organizer-problems.spec.ts, so the front's own
    // navigation to that path is not intercepted.
    const listApiUrl = `${BACK_URL}/organizer/rounds`
    await page.route(listApiUrl, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        route.continue()
      }
    })
    await page.goto('/organizer/rounds')
    await expect(page.getByTestId('organizer-rounds-empty')).toBeVisible()
    await page.screenshot({ path: evidence('01-empty-state'), fullPage: true })
    await page.unroute(listApiUrl)

    // 02 — create form: fill name/duration, select the published problem.
    await page.getByTestId('organizer-rounds-empty').getByRole('link').click()
    await expect(page.getByTestId('round-form')).toBeVisible()
    await page.getByTestId('round-form-name').fill(roundAName)
    await page.getByTestId('round-form-duration').fill('20')
    await page.getByTestId(`round-form-problem-${problemId}-checkbox`).click()
    await page.screenshot({ path: evidence('02-create-form-filled'), fullPage: true })

    await page.getByTestId('round-form-save').click()
    await expect(page).toHaveURL(/\/organizer\/rounds$/)
    const roundARow = page.getByTestId('organizer-rounds-table').getByText(roundAName)
    await expect(roundARow).toBeVisible()

    // 03 — a second draft round, so #2's "Abrir disabled while another round
    // is open" has something to disable once A opens below.
    await page.getByTestId('organizer-rounds-create').click()
    await page.getByTestId('round-form-name').fill(roundBName)
    await page.getByTestId('round-form-duration').fill('15')
    await page.getByTestId(`round-form-problem-${problemId}-checkbox`).click()
    await page.getByTestId('round-form-save').click()
    await expect(page).toHaveURL(/\/organizer\/rounds$/)
    await page.screenshot({ path: evidence('03-two-draft-rounds'), fullPage: true })

    const rows = await page
      .getByTestId('organizer-rounds-table')
      .locator('tbody tr')
      .evaluateAll((trs) =>
        trs.map((tr) => ({
          id: tr.getAttribute('data-testid')?.replace('organizer-rounds-row-', ''),
          name: tr.textContent ?? '',
        })),
      )
    const roundAId = rows.find((r) => r.name.includes(roundAName))?.id
    const roundBId = rows.find((r) => r.name.includes(roundBName))?.id
    if (!roundAId || !roundBId) throw new Error('expected both seeded rounds in the table')

    // 04 — Abrir confirmation dialog on round A.
    await page.getByTestId(`organizer-rounds-open-${roundAId}`).click()
    await expect(page.getByTestId('organizer-rounds-open-confirm')).toBeVisible()
    await page.screenshot({ path: evidence('04-open-confirm-dialog'), fullPage: true })

    // 05 — confirmed: A is open with a live countdown, B's Abrir is disabled
    // and its tooltip names A (Acceptance #2).
    await page.getByTestId('organizer-rounds-open-confirm').click()
    // Opened through the UI, so `roundSlot.open` never saw it — hand it over
    // anyway, or a failure between here and step 08 leaves it open (#150).
    roundSlot.register(roundAId)
    await expect(page.getByTestId(`organizer-rounds-close-${roundAId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-rounds-open-${roundBId}`)).toBeDisabled()
    await page.getByTestId(`organizer-rounds-open-hint-${roundBId}`).hover()
    await expect(page.getByRole('tooltip')).toContainText(roundAName)
    await page.screenshot({ path: evidence('05-a-open-b-disabled'), fullPage: true })

    // 05b — #129: the same tooltip via keyboard focus (the wrapper span is
    // now tabIndex={0}), not just hover.
    await page.getByTestId(`organizer-rounds-open-hint-${roundBId}`).focus()
    await expect(page.getByRole('tooltip')).toContainText(roundAName)
    await page.screenshot({ path: evidence129('05b-open-hint-focus'), fullPage: true })

    // 06 — editing an open round's problems is blocked with an explanation
    // (Acceptance #4). The list no longer links to it once it's open, so
    // this navigates the edit route directly.
    await page.goto(`/organizer/rounds/${roundAId}/edit`)
    await expect(page.getByTestId('round-form-not-draft')).toBeVisible()
    await page.screenshot({ path: evidence('06-edit-blocked-not-draft'), fullPage: true })

    // 07 — Estender: open the dialog, submit an invalid value first (Acceptance
    // guards against a non-positive extension), then a valid one.
    await page.goto('/organizer/rounds')
    await page.getByTestId(`organizer-rounds-extend-${roundAId}`).click()
    await page.getByTestId('organizer-rounds-extend-minutes').fill('0')
    await page.getByTestId('organizer-rounds-extend-confirm').click()
    await expect(page.getByTestId('organizer-rounds-extend-error')).toBeVisible()
    await page.screenshot({ path: evidence('07a-extend-invalid'), fullPage: true })

    await page.getByTestId('organizer-rounds-extend-minutes').fill('5')
    await page.getByTestId('organizer-rounds-extend-confirm').click()
    await expect(page.getByTestId('organizer-rounds-extend-dialog')).toBeHidden()
    await page.screenshot({ path: evidence('07b-extend-applied'), fullPage: true })

    // 08 — Encerrar antecipado: confirm, then the row shows the close date
    // read-only (Acceptance #3).
    await page.getByTestId(`organizer-rounds-close-${roundAId}`).click()
    await expect(page.getByTestId('organizer-rounds-close-confirm')).toBeVisible()
    await page.getByTestId('organizer-rounds-close-confirm').click()
    await expect(page.getByTestId(`organizer-rounds-closed-at-${roundAId}`)).toBeVisible()
    await expect(page.getByTestId(`organizer-rounds-open-${roundBId}`)).toBeEnabled()
    await page.screenshot({ path: evidence('08-round-a-closed'), fullPage: true })
  })
})
