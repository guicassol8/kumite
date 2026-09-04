import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #12. Prereqs (like auth.hurl / auth.spec.ts):
//   docker compose up -d && pnpm db:migrate
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment (used to run
// `pnpm db:seed` beforehand and read here to log in as that account).
// The 01 empty state is shot against a stubbed empty list instead of an empty
// table: the dev DB is shared across worktrees, `pnpm db:seed` itself inserts
// sample problems, and organizer-problem-form.spec.ts (#13) creates one of its
// own in parallel — so global emptiness is not something this suite can rely on.
const evidence = (name: string) => `e2e/evidence/12/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`

test.describe('organizer problems list', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_EMAIL)
  }

  // The seed calls below hit /organizer/problems* directly (no UI), so they
  // need their own bearer token now that #27 guards those routes.
  let organizerToken: string | undefined
  async function organizerAuthHeader(): Promise<Record<string, string>> {
    if (!organizerToken) {
      const res = await fetch(`${BACK_URL}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
      })
      const { token } = (await res.json()) as { token: string }
      organizerToken = token
    }
    return { authorization: `Bearer ${organizerToken}` }
  }

  async function seedDraftProblem(): Promise<string> {
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
        translations: [
          { locale: 'pt', title: 'Soma de dois números', statementMd: 'Some `a` e `b`.' },
        ],
      }),
    })
    return id
  }

  async function seedPublishedProblem(): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'hard', points: 50 }),
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
          { locale: 'pt', title: 'Ordenação', statementMd: 'Ordene a lista.' },
          { locale: 'es', title: 'Ordenamiento', statementMd: 'Ordena la lista.' },
          { locale: 'en', title: 'Sorting', statementMd: 'Sort the list.' },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  test('walks through the list: empty state, data, archive, error+retry, and navigation', async ({
    page,
  }) => {
    await loginAsOrganizer(page)

    // 01 — empty state with a shortcut to create the first problem. Scoped to
    // the back's origin, like the 05 stub below, so the front's own navigation
    // to that path is not intercepted.
    const listApiUrl = `${BACK_URL}/organizer/problems`
    await page.route(listApiUrl, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        route.continue()
      }
    })
    await page.goto('/organizer/problems')
    await expect(page.getByTestId('organizer-problems-empty')).toBeVisible()
    await page.screenshot({ path: evidence('01-empty-state'), fullPage: true })
    await page.unroute(listApiUrl)

    // 02 — a draft (pt-only) and a published (pt/es/en, 1 visible + 1 hidden
    // case) problem, seeded directly against the back, show up with their
    // título/dificuldade/pontos/estado/casos.
    const draftId = await seedDraftProblem()
    const publishedId = await seedPublishedProblem()
    await page.reload()
    const draftRow = page.getByTestId(`organizer-problems-row-${draftId}`)
    const publishedRow = page.getByTestId(`organizer-problems-row-${publishedId}`)
    await expect(draftRow).toContainText('Soma de dois números')
    await expect(draftRow).toContainText('10')
    await expect(publishedRow).toContainText('Ordenação')
    await expect(publishedRow).toContainText('2')
    await page.screenshot({ path: evidence('02-list-with-problems'), fullPage: true })

    // 03 — opening the archive dialog on the draft row.
    await page.getByTestId(`organizer-problems-archive-${draftId}`).click()
    await expect(page.getByTestId('organizer-problems-archive-confirm')).toBeVisible()
    await page.screenshot({ path: evidence('03-archive-dialog-open'), fullPage: true })

    // 04 — confirming archives it in place, without leaving the list.
    await page.getByTestId('organizer-problems-archive-confirm').click()
    await expect(draftRow).toContainText('Arquivado')
    await expect(page).toHaveURL(/\/organizer\/problems$/)
    await page.screenshot({ path: evidence('04-archived-in-place'), fullPage: true })

    // 05 — a forced 500 shows the recoverable error state; retry refetches.
    // Scoped to the back's origin: an unscoped "**/organizer/problems" glob
    // also matches the front's own page navigation to that path.
    await page.route(listApiUrl, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      } else {
        route.continue()
      }
    })
    await page.reload()
    await expect(page.getByTestId('organizer-problems-error')).toBeVisible()
    await page.screenshot({ path: evidence('05-error-state'), fullPage: true })

    await page.unroute(listApiUrl)
    await page.getByTestId('organizer-problems-error-retry').click()
    await expect(page.getByTestId('organizer-problems-table')).toBeVisible()

    // 06 — create/edit links land on the problem form (#13 replaced the
    // placeholders these two steps used to assert).
    await page.getByTestId('organizer-problems-create').click()
    await expect(page.getByTestId('problem-form')).toBeVisible()
    await expect(page).toHaveURL(/\/organizer\/problems\/new$/)
    await page.screenshot({ path: evidence('06a-create-form'), fullPage: true })

    await page.goBack()
    await expect(page.getByTestId('organizer-problems-table')).toBeVisible()
    await page.getByTestId(`organizer-problems-edit-${publishedId}`).click()
    await expect(page.getByTestId('problem-form')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/organizer/problems/${publishedId}/edit$`))
    await page.screenshot({ path: evidence('06b-edit-form'), fullPage: true })
  })
})
