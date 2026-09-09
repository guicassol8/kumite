import {
  BACK_URL,
  createRound,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// The footer is the event's only contact channel, so these specs cover what the
// component test cannot: that it survives real routing and that it actually
// lands at the bottom of a short page instead of floating over the content.
test.describe('global footer', () => {
  test('is visible on the home route for an anonymous visitor', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
    await expect(page.getByTestId('footer-contact-email')).toHaveText('ligadealgoritmos@gmail.com')
  })

  test('is visible on /login, where the visitor has no session', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
  })

  // Acceptance: "WHEN a página tem conteúdo mais curto que a viewport THE
  // SYSTEM SHALL manter o footer no rodapé, sem sobrepor o conteúdo."
  test('sits at the bottom of a short page without overlapping the content', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('app-footer')).toBeVisible()

    const viewport = page.viewportSize()
    if (!viewport) throw new Error('expected a fixed viewport for this assertion')

    const footerBox = await page.getByTestId('app-footer').boundingBox()
    const mainBox = await page.locator('main').first().boundingBox()
    if (!footerBox || !mainBox) throw new Error('expected footer and main to be laid out')

    // Fully inside the viewport: no scrolling needed to reach the contact.
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height)
    // Below the content, never on top of it.
    expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height)
  })
})

// Visual walkthrough for #144, one screenshot per acceptance criterion.
const evidence = (name: string) => `e2e/evidence/144/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()

test.describe('global footer — visual walkthrough (#144)', () => {
  test('shows the contact on every anonymous route, pinned to the bottom', async ({ page }) => {
    // 01 — home, anonymous: the contact is the last thing on the page.
    await page.goto('/')
    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
    await page.screenshot({ path: evidence('01-home-anonimo'), fullPage: true })

    // 02 — /login: short page, no session. The footer sits at the bottom of
    // the viewport without overlapping <main>.
    await page.goto('/login')
    await expect(page.getByTestId('app-footer')).toBeVisible()
    const viewport = page.viewportSize()
    if (!viewport) throw new Error('expected a fixed viewport for this assertion')
    const footerBox = await page.getByTestId('app-footer').boundingBox()
    const mainBox = await page.locator('main').first().boundingBox()
    if (!footerBox || !mainBox) throw new Error('expected footer and main to be laid out')
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height)
    expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height)
    await page.screenshot({ path: evidence('02-login-rodape-fixado') })

    // 03 — /signup, still anonymous.
    await page.goto('/signup')
    await expect(page.getByTestId('app-footer')).toBeVisible()
    await page.screenshot({ path: evidence('03-signup-anonimo'), fullPage: true })

    // 04 — /reset-password: whoever cannot get in most needs the contact.
    await page.goto('/reset-password')
    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
    await page.screenshot({ path: evidence('04-reset-password-anonimo'), fullPage: true })
  })

  test('translates the label in pt, es and en, leaving the address untouched', async ({ page }) => {
    await page.goto('/login')

    // 05 — pt (the pinned browser locale of this suite).
    await expect(page.getByTestId('app-footer')).toContainText('Dúvidas? Fale com a organização:')
    await expect(page.getByTestId('footer-contact-email')).toHaveText('ligadealgoritmos@gmail.com')
    await page.screenshot({ path: evidence('05-rotulo-pt') })

    // 06 — es: the label changes, the address does not.
    await page.getByTestId('language-option-es').click()
    await expect(page.getByTestId('app-footer')).toContainText('¿Dudas? Habla con la organización:')
    await expect(page.getByTestId('footer-contact-email')).toHaveText('ligadealgoritmos@gmail.com')
    await page.screenshot({ path: evidence('06-rotulo-es') })

    // 07 — en, same address.
    await page.getByTestId('language-option-en').click()
    await expect(page.getByTestId('app-footer')).toContainText('Questions? Talk to the organizers:')
    await expect(page.getByTestId('footer-contact-email')).toHaveText('ligadealgoritmos@gmail.com')
    await page.screenshot({ path: evidence('07-rotulo-en') })
  })

  test('stays on screen for an authenticated participant', async ({ page }) => {
    // 08 — the other session state: signed up and logged in, same footer.
    const email = `footer-e2e-${stamp}@edu.pucrs.br`
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(email)

    await expect(page.getByTestId('app-footer')).toBeVisible()
    await expect(page.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
    await page.screenshot({ path: evidence('08-home-autenticado'), fullPage: true })
  })
})

// The one route the footer forced to change: /problem/$id used to be `h-dvh`,
// which with a header and a footer above/below would push the contact under
// the fold. This proves the editor still fits — and still runs — in the space
// between them.
test.describe('problem editor coexists with the footer (#144 T4)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  /** Setup that fails loudly: a silently-ignored 4xx here would surface later
   * as an unexplained "could not load the problem" on the screen under test. */
  async function api(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${BACK_URL}${path}`, init)
    if (!res.ok) {
      throw new Error(`setup ${init.method} ${path} failed: ${res.status} ${await res.text()}`)
    }
    return res
  }

  test('keeps header, editor and footer inside one viewport', async ({ page, roundSlot }) => {
    const auth = await organizerAuthHeader()
    const created = await api('/organizer/problems', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    const { id: problemId } = (await created.json()) as { id: string }
    await api(`/organizer/problems/${problemId}`, {
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
          { input: [10, 11, 12], expected: 22, hidden: true },
        ],
      }),
    })
    await api(`/organizer/problems/${problemId}/publish`, { method: 'POST', headers: auth })
    const roundId = await createRound(auth, {
      name: `Rodada Footer E2E ${stamp}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    const email = `footer-editor-e2e-${stamp}@edu.pucrs.br`
    await page.goto('/signup')
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(email)

    const token = await page.evaluate(() => window.localStorage.getItem('kumite-token'))
    await api('/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Footer E2E ${stamp}` }),
    })
    // This used to close every open round first. With `workers: 2` that was a
    // race that killed whichever spec was mid-run (#150): the leftovers are now
    // cleared once by `globalSetup`, before any worker starts, and contention
    // with a live spec is waited out by `roundSlot` instead of resolved by
    // force.
    await roundSlot.open(auth, roundId)

    // 09 — the editor screen: statement, Blockly canvas, header and footer all
    // laid out inside the viewport, with nothing overlapping.
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('problem-statement-panel')).toContainText('Soma dos Pares')
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()
    await expect(page.getByTestId('app-footer')).toBeVisible()

    const viewport = page.viewportSize()
    if (!viewport) throw new Error('expected a fixed viewport for this assertion')
    const headerBox = await page.getByTestId('app-header').boundingBox()
    const mainBox = await page.locator('main').first().boundingBox()
    const footerBox = await page.getByTestId('app-footer').boundingBox()
    if (!headerBox || !mainBox || !footerBox) throw new Error('expected a full layout')
    // Header, editor and footer stack without overlap, and the whole stack
    // ends inside the viewport — no scrolling to reach the contact.
    expect(mainBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height)
    expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height)
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(viewport.height + 1)
    // The editor kept real height — it did not collapse to nothing.
    expect(mainBox.height).toBeGreaterThan(200)
    await page.screenshot({ path: evidence('09-editor-com-header-e-footer') })
  })
})
