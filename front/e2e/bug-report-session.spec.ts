import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #194 — the three findings about state the bug report
// dialog used to carry from one session to the next. The dialog is mounted in
// the header, which lives in `__root.tsx`, so it never unmounts: that is what
// let a draft (and the address filled from the session) outlive the account
// that typed it.
//
// Two things about how this spec is written are load-bearing:
//
//   - **no document load between the two accounts.** A `goto` — or any reload
//     — remounts the whole SPA and throws the dialog's state away, which is
//     exactly the state under test. From the moment the first account opens the
//     dialog, every navigation goes through the header's own links, the way a
//     real user does. Same trap as `logout-isolation.spec.ts`.
//   - **no real POST.** `POST /bug-reports` has a 60s per-IP cooldown that
//     `bug-report.spec.ts` deliberately spends, and every worker shares this
//     machine's IP. Every test here intercepts `**/bug-reports` in the browser,
//     so none of them depends on — or spends — that window.
//
// Both accounts are born through the signup form with the event code, not
// through `seedParticipant`: this file then needs no ORGANIZER_EMAIL /
// ORGANIZER_PASSWORD and cannot skip itself in silence when they are unset.
const evidence = (name: string) => `e2e/evidence/194/${name}.png`

const PASSWORD = 'supersecret'
const EVENT_CODE = 'PUCRS2026'
const stamp = Date.now()

const ALUNO_A = { name: 'Bug Report A', email: `bug-report-194-a-${stamp}@edu.pucrs.br` }
const ALUNO_B = { name: 'Bug Report B', email: `bug-report-194-b-${stamp}@edu.pucrs.br` }

async function signupThroughUi(page: Page, who: { name: string; email: string }): Promise<void> {
  await page.getByTestId('signup-name-input').fill(who.name)
  await page.getByTestId('signup-email-input').fill(who.email)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill(EVENT_CODE)
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(who.name)
}

async function logoutThroughUi(page: Page): Promise<void> {
  await page.getByTestId('header-logout-button').click()
  await expect(page.getByTestId('header-login-link')).toBeVisible()
}

/** Signs in through the header link — never a document load. See the note above. */
async function loginWithoutReload(page: Page, who: { name: string; email: string }): Promise<void> {
  await page.getByTestId('header-login-link').click()
  await page.getByTestId('login-email-input').fill(who.email)
  await page.getByTestId('login-password-input').fill(PASSWORD)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(who.name)
}

test.describe('bug report across sessions (#194)', () => {
  // Acceptance: "WHEN um usuário faz logout e outro loga na mesma aba THE
  // SYSTEM SHALL preencher o diálogo de bug report com o e-mail do usuário
  // corrente." The user's decision on this issue goes further than the
  // criterion: the description goes too, not only the address.
  test('shows the next account nothing the previous one left behind', async ({ page }) => {
    // Two signups and two logins in one test — more than the 30s default.
    test.setTimeout(120_000)

    // Both accounts are created up front, so the half that matters (A's dialog
    // → logout → B's dialog) runs without a single document load.
    await page.goto('/signup')
    await signupThroughUi(page, ALUNO_A)
    await logoutThroughUi(page)
    await page.goto('/signup')
    await signupThroughUi(page, ALUNO_B)
    await logoutThroughUi(page)

    // ---- from here on, no reload ----
    await loginWithoutReload(page, ALUNO_A)
    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-email')).toHaveValue(ALUNO_A.email)
    const draftOfA = 'o ranking da minha equipe não atualiza'
    await page.getByTestId('bug-report-description').fill(draftOfA)
    // 01 — A's dialog: A's address, A's draft.
    await page.screenshot({ path: evidence('01-dialogo-do-aluno-a') })

    await page.getByTestId('bug-report-cancel').click()
    await expect(page.getByTestId('bug-report-dialog')).toHaveCount(0)
    await logoutThroughUi(page)
    await loginWithoutReload(page, ALUNO_B)

    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-email')).toHaveValue(ALUNO_B.email)
    await expect(page.getByTestId('bug-report-description')).toHaveValue('')
    await expect(page.getByTestId('bug-report-dialog')).not.toContainText(draftOfA)
    // 02 — B's dialog in the same tab, with the same component never having
    // unmounted: B's address, and nothing of A's.
    await page.screenshot({ path: evidence('02-dialogo-do-aluno-b-limpo') })
  })

  // Acceptance: "WHEN o back rejeita um relato por causa do campo de contexto
  // THE SYSTEM SHALL não culpar a descrição nem o e-mail na mensagem
  // apresentada." Fulfilled in the browser with the envelope the API really
  // produces for that case — `back/src/modules/bug-reports/bug-reports.hurl`
  // case 4b and `back/src/request-limits.test.ts` are what pin that shape
  // against the live server.
  test('does not blame the form when only the context is refused', async ({ page }) => {
    await page.route('**/bug-reports', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'validation_failed',
          message: 'Validation failed',
          issues: {
            body: [
              {
                path: 'context.userAgent',
                message: 'String must contain at most 500 character(s)',
                code: 'too_big',
              },
            ],
          },
        }),
      }),
    )

    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()
    await page.getByTestId('bug-report-description').fill('o editor de blocos travou')
    await page.getByTestId('bug-report-submit').click()

    const error = page.getByTestId('bug-report-error')
    await expect(error).toBeVisible()
    await expect(error).not.toContainText('confira a descrição')
    await expect(error).toContainText('Não conseguimos enviar o relato agora.')
    await expect(error).toContainText('ligadealgoritmos@gmail.com')
    // 03 — a refusal about the automatic context reads as a failure to send,
    // not as an instruction to fix two fields that were never wrong.
    await page.screenshot({ path: evidence('03-422-de-contexto-nao-culpa-os-campos') })
  })

  // Acceptance: "WHEN o diálogo de bug report é fechado THE SYSTEM SHALL
  // limpar o alerta de erro, de modo que a próxima abertura comece limpa."
  // The request is killed in the browser, so nothing reaches the API.
  test('opens clean after a failed send was dismissed', async ({ page }) => {
    await page.route('**/bug-reports', (route) => route.abort('failed'))

    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()
    await page.getByTestId('bug-report-description').fill('a página de ranking não carrega')
    await page.getByTestId('bug-report-submit').click()

    await expect(page.getByTestId('bug-report-error')).toBeVisible()
    // 04 — the alert as the reporter sees it.
    await page.screenshot({ path: evidence('04-alerta-de-erro-visivel') })

    await page.getByTestId('bug-report-cancel').click()
    await expect(page.getByTestId('bug-report-dialog')).toHaveCount(0)
    await page.getByTestId('header-bug-report-trigger').click()

    await expect(page.getByTestId('bug-report-error')).toHaveCount(0)
    // 05 — reopened: the draft is still there (#145), the stale alert is not.
    await expect(page.getByTestId('bug-report-description')).toHaveValue(
      'a página de ranking não carrega',
    )
    await page.screenshot({ path: evidence('05-reabertura-sem-alerta') })
  })
})

// A separate describe because `userAgent` can only be set for a whole context,
// never mid-test.
test.describe('bug report with an over-long user agent (#194)', () => {
  const LONG_AGENT = `Mozilla/5.0 ${'A'.repeat(700)}`
  test.use({ userAgent: LONG_AGENT })

  // Acceptance: "WHEN o `navigator.userAgent` excede o limite aceito pelo back
  // THE SYSTEM SHALL truncá-lo no cliente antes do envio, de modo que o relato
  // seja aceito." The request is aborted after being observed: what is asserted
  // is the payload the front built, which is where the truncation lives.
  test('trims the user agent to the ceiling before sending', async ({ page }) => {
    await page.route('**/bug-reports', (route) => route.abort('failed'))

    await page.goto('/')
    expect(await page.evaluate(() => navigator.userAgent)).toHaveLength(LONG_AGENT.length)

    await page.getByTestId('header-bug-report-trigger').click()
    await page.getByTestId('bug-report-description').fill('o botão de enviar não responde')

    const posted = page.waitForRequest(
      (req) => req.url().endsWith('/bug-reports') && req.method() === 'POST',
    )
    await page.getByTestId('bug-report-submit').click()

    const body = (await posted).postDataJSON() as { context?: { userAgent?: string } }
    expect(body.context?.userAgent).toHaveLength(500)
    // The prefix, so the browser and its version survive the cut.
    expect(LONG_AGENT.startsWith(body.context?.userAgent ?? '')).toBe(true)
    // 06 — the dialog after the aborted send, proving the report left the
    // client: before #194 this payload carried 712 characters and the API
    // answered 422 about a field that is not on the form.
    await page.screenshot({ path: evidence('06-user-agent-longo-cortado') })
  })
})
