import { expect, type Page, test } from '@playwright/test'
import { ORGANIZER_NAME } from './support/rounds'

// Visual walkthrough for #13. Prereqs (like organizer-problems.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment to log in as the
// seeded organizer. Unlike #12's spec this one doesn't need an empty
// `problems` table — every assertion is scoped to the problem it creates.
const evidence = (name: string) => `e2e/evidence/13/${name}.png`
const evidence129 = (name: string) => `e2e/evidence/129/${name}.png`
const evidence187 = (name: string) => `e2e/evidence/187/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`

const PT_STATEMENT = [
  '# Soma de dois números',
  '',
  'Some `a` e `b` e devolva o resultado.',
  '',
  '| entrada | saída |',
  '| --- | --- |',
  '| `[1, 2]` | `3` |',
].join('\n')

test.describe('organizer problem form', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
  }

  test('creates, validates, saves and publishes a problem end to end', async ({ page }) => {
    await loginAsOrganizer(page)

    // Counts the publish calls that actually leave the browser, so step 06 can
    // prove the client-side validation short-circuits before the API.
    let publishRequests = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().startsWith(`${BACK_URL}/organizer/problems`))
        if (request.url().endsWith('/publish')) publishRequests += 1
    })

    // 01 — the empty create form: difficulty, points, the three language tabs
    // and an empty test-case section.
    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form')).toBeVisible()
    await expect(page.getByTestId('problem-form-cases-empty')).toBeVisible()
    await page.screenshot({ path: evidence('01-empty-form'), fullPage: true })

    // 02 — filling the PT tab renders the markdown live in the preview beside
    // the textarea (heading, inline code and a GFM table).
    await page.getByTestId('problem-form-title-pt').fill('Soma de dois números')
    await page.getByTestId('problem-form-statement-pt').fill(PT_STATEMENT)
    await expect(page.getByTestId('problem-form-preview-pt').locator('h1')).toHaveText(
      'Soma de dois números',
    )
    await expect(page.getByTestId('problem-form-preview-pt').locator('table')).toBeVisible()
    await page.screenshot({ path: evidence('02-pt-markdown-preview'), fullPage: true })

    // 03 — two cases (one visible, one hidden), then ↑ swaps them: the hidden
    // one moves to row 0 and takes its checkbox state with it.
    await page.getByTestId('problem-form-add-case').click()
    await page.getByTestId('problem-form-case-0-input').fill('[1, 2]')
    await page.getByTestId('problem-form-case-0-expected').fill('3')
    await page.getByTestId('problem-form-add-case').click()
    await page.getByTestId('problem-form-case-1-input').fill('[4, 5]')
    await page.getByTestId('problem-form-case-1-expected').fill('9')
    await page.getByTestId('problem-form-case-1-hidden').click()

    await page.getByTestId('problem-form-case-1-up').click()
    await expect(page.getByTestId('problem-form-case-0-input')).toHaveValue('[4, 5]')
    await expect(page.getByTestId('problem-form-case-0-hidden')).toHaveAttribute(
      'data-state',
      'checked',
    )
    await expect(page.getByTestId('problem-form-case-1-input')).toHaveValue('[1, 2]')
    await page.screenshot({ path: evidence('03-cases-reordered'), fullPage: true })

    // 04 — acceptance #1: a malformed JSON value is flagged on blur, on that
    // field only; the other field and the other row keep their values.
    await page.getByTestId('problem-form-case-0-input').fill('[4, 5')
    await page.getByTestId('problem-form-case-0-expected').click()
    await expect(page.getByTestId('problem-form-case-0-input-error')).toHaveText('JSON inválido')
    await expect(page.getByTestId('problem-form-case-0-expected')).toHaveValue('9')
    await expect(page.getByTestId('problem-form-case-1-input')).toHaveValue('[1, 2]')
    await expect(page.getByTestId('problem-form-case-1-expected')).toHaveValue('3')
    await page.screenshot({ path: evidence('04-invalid-json-scoped'), fullPage: true })

    // 05 — acceptance #3: fixed up, a PT-only draft saves and the screen moves
    // to the edit route with everything persisted.
    await page.getByTestId('problem-form-case-0-input').fill('[4, 5]')
    await page.getByTestId('problem-form-save').click()
    await expect(page).toHaveURL(/\/organizer\/problems\/[^/]+\/edit$/)
    await expect(page.getByTestId('problem-form-status')).toHaveText('Rascunho')
    await expect(page.getByTestId('problem-form-title-pt')).toHaveValue('Soma de dois números')
    await expect(page.getByTestId('problem-form-case-0-input')).toHaveValue('[4,5]')
    await page.screenshot({ path: evidence('05-saved-draft'), fullPage: true })

    const problemId = new URL(page.url()).pathname.split('/').at(-2) as string

    // 06 — acceptance #2: publishing a PT-only draft flags the ES and EN tabs
    // and never reaches the API.
    await page.getByTestId('problem-form-publish').click()
    await expect(page.getByTestId('problem-form-tab-es')).toHaveAttribute('data-invalid', 'true')
    await expect(page.getByTestId('problem-form-tab-en')).toHaveAttribute('data-invalid', 'true')
    await expect(page.getByTestId('problem-form-title-es-error')).toContainText(
      'complete a tradução deste idioma',
    )
    expect(publishRequests).toBe(0)
    await page.screenshot({ path: evidence('06-publish-blocked-by-locales'), fullPage: true })

    // 07 — with ES and EN filled in, Publicar succeeds and drops back on the
    // list, where the row now reads "Publicado".
    await page.getByTestId('problem-form-title-es').fill('Suma de dos números')
    await page.getByTestId('problem-form-statement-es').fill('Suma `a` y `b`.')
    await page.getByTestId('problem-form-tab-en').click()
    await page.getByTestId('problem-form-title-en').fill('Sum of two numbers')
    await page.getByTestId('problem-form-statement-en').fill('Sum `a` and `b`.')
    await page.getByTestId('problem-form-publish').click()

    await expect(page).toHaveURL(/\/organizer\/problems$/)
    const row = page.getByTestId(`organizer-problems-row-${problemId}`)
    await expect(row).toContainText('Soma de dois números')
    await expect(row).toContainText('Publicado')
    await page.screenshot({ path: evidence('07-published-in-list'), fullPage: true })

    // 08 — acceptance #4: editing a published problem and saving keeps it
    // published; Publicar is disabled with the reason on its tooltip.
    await page.getByTestId(`organizer-problems-edit-${problemId}`).click()
    await expect(page.getByTestId('problem-form-status')).toHaveText('Publicado')
    await expect(page.getByTestId('problem-form-publish')).toBeDisabled()
    await page
      .getByTestId('problem-form-statement-pt')
      .fill(`${PT_STATEMENT}\n\nO resultado é um número inteiro.`)
    await page.getByTestId('problem-form-save').click()

    await expect(page.getByTestId('problem-form-success')).toContainText('Alterações salvas.')
    await expect(page.getByTestId('problem-form-status')).toHaveText('Publicado')
    await expect(page).toHaveURL(new RegExp(`/organizer/problems/${problemId}/edit$`))
    await page.screenshot({ path: evidence('08-published-edit-saved'), fullPage: true })

    // 09 — #129: the publish-disabled tooltip shows on hover, and — since the
    // wrapper span is now keyboard-focusable — on Tab focus too, with the
    // same reason.
    await page.getByTestId('problem-form-publish-hint').hover()
    await expect(page.getByRole('tooltip')).toContainText('Este problema já está publicado.')

    await page.getByTestId('problem-form-publish-hint').focus()
    await expect(page.getByRole('tooltip')).toContainText('Este problema já está publicado.')
    await page.screenshot({ path: evidence129('09-publish-hint-focus'), fullPage: true })
  })

  // #187: the reproduction from the issue. Before this task the field accepted
  // the value, the API answered (a 500, in fact — `points` had no ceiling at
  // all), and the screen said only "Não foi possível salvar o problema. Tente
  // novamente." with `problem-form-points-error` absent from the DOM.
  test('names the points ceiling instead of asking the organizer to try again', async ({
    page,
  }) => {
    await loginAsOrganizer(page)

    // Nothing may leave the browser: the acceptance is that the organizer
    // learns the limit without a round-trip.
    let createRequests = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url() === `${BACK_URL}/organizer/problems`)
        createRequests += 1
    })

    await page.goto('/organizer/problems/new')
    await expect(page.getByTestId('problem-form')).toBeVisible()

    await page.getByTestId('problem-form-title-pt').fill('Soma de dois números')
    await page.getByTestId('problem-form-statement-pt').fill(PT_STATEMENT)
    await page.getByTestId('problem-form-points').fill('9999999999')
    await page.screenshot({ path: evidence187('01-points-huge-typed'), fullPage: true })

    await page.getByTestId('problem-form-save').click()

    const pointsError = page.getByTestId('problem-form-points-error')
    await expect(pointsError).toBeVisible()
    await expect(pointsError).toContainText('10000')
    // The generic alert must stay away — that is the whole bug.
    await expect(page.getByTestId('problem-form-error')).toBeHidden()
    await page.screenshot({ path: evidence187('02-points-error-under-field'), fullPage: true })

    expect(createRequests).toBe(0)
    // Nothing was created, so the problems list is untouched by this test.
    await expect(page).toHaveURL(/\/organizer\/problems\/new$/)
  })
})
