import { expect, test } from '@playwright/test'
import { E2E_PARTICIPANT_NAME } from './support/rounds'

// Visual walkthrough for #145, one screenshot per acceptance criterion.
//
// The dialog itself is covered as a unit in `src/components/bug-report.test.tsx`
// and the desktop/mobile triggers in `src/components/header.test.tsx` (the FAB
// this spec used to click is gone — the trigger moved into the header on
// #217). What only a real browser can prove is what lives here: that the
// trigger survives real routing on every route, that a report actually
// reaches the API, and that the back's per-IP cooldown answers 429 to the
// second one — the component tests mock `fetch` and so cannot see any of
// that.
const evidence = (name: string) => `e2e/evidence/145/${name}.png`

const CONTACT_EMAIL = 'ligadealgoritmos@gmail.com'
const PASSWORD = 'supersecret'
const stamp = Date.now()

// The cooldown is per IP and every worker shares this machine's, so exactly
// one test in this file is allowed to POST for real (the 200 → 429 pair
// below). Every other test either stops at client-side validation or aborts
// the request in the browser, and so never spends the window.

test.describe('bug report — visual walkthrough (#145)', () => {
  // Acceptance: "WHEN o usuário abre qualquer rota do app THE SYSTEM SHALL
  // exibir o gatilho de reportar bug, autenticado ou não."
  test('shows the trigger on every anonymous route', async ({ page }) => {
    // 01 — home, anonymous.
    await page.goto('/')
    await expect(page.getByTestId('header-bug-report-trigger')).toBeVisible()
    await page.screenshot({ path: evidence('01-gatilho-home-anonimo'), fullPage: true })

    // 02 — /login: whoever cannot get in is exactly who needs to report it.
    await page.goto('/login')
    await expect(page.getByTestId('header-bug-report-trigger')).toBeVisible()
    await page.screenshot({ path: evidence('02-gatilho-login') })

    // 03 — /reset-password, still anonymous.
    await page.goto('/reset-password')
    await expect(page.getByTestId('header-bug-report-trigger')).toBeVisible()
    await page.screenshot({ path: evidence('03-gatilho-reset-password') })
  })

  // Acceptance: "WHEN o usuário aciona o gatilho THE SYSTEM SHALL abrir o
  // dialog com o campo de descrição vazio e, se houver sessão, o campo de
  // e-mail pré-preenchido."
  test('opens an empty dialog for an anonymous visitor', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()

    await expect(page.getByTestId('bug-report-dialog')).toBeVisible()
    await expect(page.getByTestId('bug-report-description')).toHaveValue('')
    await expect(page.getByTestId('bug-report-email')).toHaveValue('')
    // 04 — the empty form, with the counter at zero.
    await expect(page.getByTestId('bug-report-counter')).toHaveText('0/2000')
    await page.screenshot({ path: evidence('04-dialog-vazio-anonimo') })
  })

  // Acceptance: "WHEN a descrição está vazia ... o front SHALL exibir o erro
  // sem fechar o dialog."
  test('refuses an empty description without closing the dialog', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()
    await page.getByTestId('bug-report-submit').click()

    // 05 — the dialog is still open, with the field-level message.
    await expect(page.getByTestId('bug-report-dialog')).toBeVisible()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Escreva o que aconteceu.')
    await page.screenshot({ path: evidence('05-descricao-vazia-erro') })
  })

  // Acceptance: "WHEN o campo de e-mail é preenchido com um valor que não é um
  // e-mail válido ... exibir o erro sem fechar o dialog."
  //
  // There are two guards, and only the second one is ours. `type="email"` means
  // the browser refuses a grossly malformed value with its own bubble before
  // react-hook-form runs — so the case worth asserting is `ada@pucrs`, which
  // the native check accepts (HTML5 does not require a dot in the domain) and
  // zod is what refuses. Same boundary the component test documents.
  test('refuses an invalid reply-to address without closing the dialog', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()
    await page.getByTestId('bug-report-description').fill('o editor de blocos travou')

    // 06 — the native guard: nothing is submitted and the dialog stays open.
    // The bubble itself is the browser's, drawn outside the page and following
    // the browser's own language, not our catalogs.
    await page.getByTestId('bug-report-email').fill('nao-e-um-email')
    await page.getByTestId('bug-report-submit').click()
    await expect(page.getByTestId('bug-report-dialog')).toBeVisible()
    expect(
      await page
        .getByTestId('bug-report-email')
        .evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBe(false)
    await page.screenshot({ path: evidence('06-email-malformado-guarda-nativa') })

    // 07 — our guard, in the active language, with the draft untouched.
    await page.getByTestId('bug-report-email').fill('ada@pucrs')
    await page.getByTestId('bug-report-submit').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText(
      'Digite um e-mail válido ou deixe o campo em branco.',
    )
    await expect(page.getByTestId('bug-report-description')).toHaveValue(
      'o editor de blocos travou',
    )
    await page.screenshot({ path: evidence('07-email-invalido-erro-traduzido') })
  })

  // Acceptance: "WHEN o envio falha por rede ou erro de servidor THE SYSTEM
  // SHALL manter o texto digitado no dialog e exibir mensagem de erro com o
  // e-mail de contato como alternativa."
  //
  // The request is killed in the browser, so this never reaches the API and
  // never spends the per-IP cooldown.
  test('keeps the draft and offers the contact address when the network fails', async ({
    page,
  }) => {
    await page.route('**/bug-reports', (route) => route.abort('failed'))

    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()
    const draft = 'a página de ranking não carrega no celular'
    await page.getByTestId('bug-report-description').fill(draft)
    await page.getByTestId('bug-report-submit').click()

    // 08 — generic failure, the fallback address, and the draft preserved.
    await expect(page.getByTestId('bug-report-error')).toContainText(
      'Não conseguimos enviar o relato agora.',
    )
    await expect(page.getByTestId('bug-report-error')).toContainText(CONTACT_EMAIL)
    await expect(page.getByTestId('bug-report-description')).toHaveValue(draft)
    await page.screenshot({ path: evidence('08-falha-de-rede-rascunho-preservado') })
  })

  // Acceptance: "WHEN o usuário envia uma descrição válida THE SYSTEM SHALL
  // enviar POST /bug-reports ... e exibir confirmação de envio", followed by
  // "WHEN o mesmo IP envia um segundo bug report dentro da janela de cooldown
  // THE SYSTEM SHALL responder 429 e o front SHALL exibir mensagem pedindo
  // para aguardar, oferecendo o e-mail de contato como alternativa."
  //
  // Both halves live in one test on purpose: the 429 only exists because the
  // 200 immediately before it armed this IP's window.
  test('sends a real report, then is throttled on the second one', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('header-bug-report-trigger').click()

    // The payload the front builds itself — asserted here rather than trusted,
    // because `context` is attached automatically and is never a form field.
    const posted = page.waitForRequest(
      (req) => req.url().endsWith('/bug-reports') && req.method() === 'POST',
    )

    await page
      .getByTestId('bug-report-description')
      .fill('O botão de enviar não responde na terceira questão')
    await page.getByTestId('bug-report-email').fill('ada@edu.pucrs.br')
    // 09 — the filled form, with the counter tracking what was typed.
    await expect(page.getByTestId('bug-report-counter')).toHaveText('50/2000')
    await page.screenshot({ path: evidence('09-formulario-preenchido') })

    await page.getByTestId('bug-report-submit').click()

    const body = (await posted).postDataJSON() as {
      description: string
      replyTo?: string
      context?: Record<string, string>
    }
    expect(body.description).toBe('O botão de enviar não responde na terceira questão')
    expect(body.replyTo).toBe('ada@edu.pucrs.br')
    // Route, user agent and timestamp ride along without the user typing them.
    expect(body.context?.route).toBe('/')
    expect(body.context?.userAgent).toContain('Mozilla')
    expect(body.context?.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // 10 — the confirmation state, inside the dialog, with a Close button.
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Relato enviado')
    await expect(page.getByTestId('bug-report-close')).toBeVisible()
    await page.screenshot({ path: evidence('10-confirmacao-de-envio') })

    // A successful send is the only thing that clears the draft.
    await page.getByTestId('bug-report-close').click()
    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-description')).toHaveValue('')
    // 11 — reopened after a success: the form is blank again, and the address
    // the reporter gave is kept so a second report costs less typing.
    await expect(page.getByTestId('bug-report-email')).toHaveValue('ada@edu.pucrs.br')
    await page.screenshot({ path: evidence('11-rascunho-limpo-apos-sucesso') })

    // The second report from this IP, inside the 60s window: a real 429 from
    // the back's cooldown, not a mocked one.
    const retry = 'e agora o placar sumiu'
    await page.getByTestId('bug-report-description').fill(retry)
    await page.getByTestId('bug-report-submit').click()

    // 12 — the throttled message, the fallback address, and the draft kept.
    await expect(page.getByTestId('bug-report-error')).toContainText(
      'Você acabou de enviar um relato. Aguarde um minuto antes de enviar outro.',
    )
    await expect(page.getByTestId('bug-report-error')).toContainText(CONTACT_EMAIL)
    await expect(page.getByTestId('bug-report-description')).toHaveValue(retry)
    await page.screenshot({ path: evidence('12-429-aguarde-com-email-alternativo') })
  })

  // Acceptance: "WHEN o usuário aciona o gatilho ... se houver sessão, o campo
  // de e-mail pré-preenchido com o e-mail do usuário."
  test('prefills the email from the session, and keeps it editable', async ({ page }) => {
    const email = `bug-report-e2e-${stamp}@edu.pucrs.br`
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill(E2E_PARTICIPANT_NAME)
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)

    // 13 — the trigger is there for an authenticated participant too.
    await expect(page.getByTestId('header-bug-report-trigger')).toBeVisible()
    await page.screenshot({ path: evidence('13-gatilho-autenticado'), fullPage: true })

    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-description')).toHaveValue('')
    // 14 — the session address filled in, the description still blank.
    await expect(page.getByTestId('bug-report-email')).toHaveValue(email)
    await page.screenshot({ path: evidence('14-email-preenchido-pela-sessao') })

    // A starting point, not a lock.
    await page.getByTestId('bug-report-email').fill('outro@edu.pucrs.br')
    await expect(page.getByTestId('bug-report-email')).toHaveValue('outro@edu.pucrs.br')
    // 15 — overwritten by hand.
    await page.screenshot({ path: evidence('15-email-editavel') })
  })

  // Acceptance: "WHEN o idioma ativo é pt, es ou en THE SYSTEM SHALL exibir
  // todos os textos do formulário e das mensagens de erro no idioma
  // correspondente."
  test('translates the form and its error messages in pt, es and en', async ({ page }) => {
    await page.goto('/')

    // 16 — pt, the suite's pinned browser locale. The error is produced by
    // submitting empty, so nothing is sent in any of the three passes.
    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Reportar um bug')
    await expect(page.getByTestId('bug-report-dialog')).toContainText('O que aconteceu?')
    await page.getByTestId('bug-report-submit').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Escreva o que aconteceu.')
    await page.screenshot({ path: evidence('16-formulario-pt') })
    await page.getByTestId('bug-report-cancel').click()

    // 17 — es.
    await page.getByTestId('language-option-es').click()
    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Reportar un error')
    await expect(page.getByTestId('bug-report-dialog')).toContainText('¿Qué pasó?')
    await page.getByTestId('bug-report-submit').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Escribe qué pasó.')
    await page.screenshot({ path: evidence('17-formulario-es') })
    await page.getByTestId('bug-report-cancel').click()

    // 18 — en.
    await page.getByTestId('language-option-en').click()
    await page.getByTestId('header-bug-report-trigger').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Report a bug')
    await expect(page.getByTestId('bug-report-dialog')).toContainText('What happened?')
    await page.getByTestId('bug-report-submit').click()
    await expect(page.getByTestId('bug-report-dialog')).toContainText('Write what happened.')
    await page.screenshot({ path: evidence('18-formulario-en') })
  })
})
