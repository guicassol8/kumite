import {
  BACK_URL,
  createRound,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual walkthrough for #217 — chrome header/footer, live round chip, user
// menu, mobile panel, and the light/dark toggle. One screenshot per
// Acceptance criterion, at the two viewports the identity spec cares about:
// 1280×800 (desktop chrome) and 390×844 (the mobile panel, and the width the
// no-horizontal-scroll acceptance is written against).
const evidence = (name: string) => `e2e/evidence/217/${name}.png`

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

const PASSWORD = 'supersecret'
const stamp = Date.now()

async function expectNoHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function signUpParticipant(page: import('@playwright/test').Page, email: string) {
  await page.goto('/signup')
  await page.getByTestId('signup-name-input').fill('E2E Participante')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill('PUCRS2026')
  await page.getByTestId('signup-submit-button').click()
  // Not header-user-email: that span lives inside the desktop-only user
  // menu (hidden md:flex), so it never becomes visible at a mobile
  // viewport even once signed in. The redirect home is viewport-agnostic.
  await expect(page).toHaveURL(/\/$/)
}

test.describe('header/footer — anonymous, desktop (#217)', () => {
  test('shows the chrome bar, login/signup, theme and bug report — no round chip or user menu', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    await expect(page.getByTestId('app-header')).toBeVisible()
    await expect(page.getByTestId('header-login-link')).toBeVisible()
    await expect(page.getByTestId('header-signup-link')).toBeVisible()
    await expect(page.getByTestId('header-theme-toggle')).toBeVisible()
    await expect(page.getByTestId('header-bug-report-trigger')).toBeVisible()
    await expect(page.getByTestId('header-round-chip')).toHaveCount(0)
    await expect(page.getByTestId('header-user-menu-trigger')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    // 01 — anonymous desktop chrome.
    await page.screenshot({ path: evidence('01-desktop-anonimo'), fullPage: true })
  })

  test('shows the API status and event mark in the footer', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')

    const footer = page.getByTestId('app-footer')
    await expect(footer).toBeVisible()
    await expect(footer.getByTestId('footer-contact-email')).toHaveAttribute(
      'href',
      'mailto:ligadealgoritmos@gmail.com',
    )
    await expect(footer.getByTestId('api-status-ok')).toBeVisible()
    await expect(footer).toContainText('PUCRS × Mérida 2026')

    // 02 — the footer band on its own.
    await footer.screenshot({ path: evidence('02-rodape-status-e-marca') })
  })
})

test.describe('header/footer — authenticated participant, desktop (#217)', () => {
  test('opens the user menu with name, email and a single change-password action', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await signUpParticipant(page, `header-217-${stamp}@edu.pucrs.br`)

    await page.getByTestId('header-user-menu-trigger').click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu).toContainText('E2E Participante')
    await expect(menu.getByTestId('header-change-password-link')).toBeVisible()
    // Idiom, tema e Sair continuam na barra, fora do menu.
    await expect(page.getByTestId('language-selector')).toBeVisible()
    await expect(page.getByTestId('header-theme-toggle')).toBeVisible()
    await expect(page.getByTestId('header-logout-button')).toBeVisible()

    // 03 — the user dropdown open (MenuUsuario.png).
    await page.screenshot({ path: evidence('03-menu-usuario') })
  })

  test('alternates light and dark on the theme toggle', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await signUpParticipant(page, `header-217-theme-${stamp}@edu.pucrs.br`)

    await expect(page.locator('html')).not.toHaveClass(/dark/)
    // 04 — light, authenticated.
    await page.screenshot({ path: evidence('04-tema-claro'), fullPage: true })

    await page.getByTestId('header-theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 05 — dark, immediately after the toggle (Acceptance: "alternar
    // imediatamente e persistir a escolha").
    await page.screenshot({ path: evidence('05-tema-escuro'), fullPage: true })

    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})

test.describe('header — live round chip (#217)', () => {
  test.skip(!hasOrganizerCredentials, 'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD')

  test('shows name and countdown in the header while a round is open', async ({
    page,
    roundSlot,
  }) => {
    await page.setViewportSize(DESKTOP)
    const auth = await organizerAuthHeader()

    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    const { id: problemId } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${problemId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: 'Soma', statementMd: 'Some os números.' },
          { locale: 'es', title: 'Suma', statementMd: 'Suma los números.' },
          { locale: 'en', title: 'Sum', statementMd: 'Sum the numbers.' },
        ],
        // Publish requires both a visible and a hidden case.
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [4, 5], expected: 9, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${problemId}/publish`, {
      method: 'POST',
      headers: auth,
    })
    const roundId = await createRound(auth, {
      name: `Rodada Header E2E ${stamp}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    await signUpParticipant(page, `header-217-round-${stamp}@edu.pucrs.br`)
    await roundSlot.open(auth, roundId)
    await page.reload()

    const chip = page.getByTestId('header-round-chip')
    await expect(chip).toBeVisible()
    await expect(chip).toContainText(`Rodada Header E2E ${stamp}`)
    await expect(chip.getByTestId('round-countdown')).toBeVisible()

    // 06 — the live round chip in the header.
    await page.screenshot({ path: evidence('06-chip-rodada-ao-vivo') })
  })
})

test.describe('header/footer — mobile 390×844 (#217, closes #186/#198)', () => {
  test('opens the menu panel with nav, user block, theme, bug report and Sair', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE)
    await signUpParticipant(page, `header-217-mobile-${stamp}@edu.pucrs.br`)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('header-mobile-menu-trigger').click()
    // header-teams-link/header-leaderboard-link are also shared with the
    // always-mounted desktop nav (hidden md:flex), so they're scoped to the
    // open panel; header-change-password-link only exists here since the
    // desktop copy lives inside the (closed) user-menu dropdown.
    const panel = page.getByRole('dialog')
    await expect(page.getByTestId('header-mobile-user-block')).toBeVisible()
    await expect(page.getByTestId('header-mobile-home-link')).toBeVisible()
    await expect(panel.getByTestId('header-teams-link')).toBeVisible()
    await expect(panel.getByTestId('header-leaderboard-link')).toBeVisible()
    await expect(page.getByTestId('header-change-password-link')).toBeVisible()
    await expect(page.getByTestId('header-mobile-theme-toggle')).toBeVisible()
    await expect(page.getByTestId('header-mobile-bug-report-trigger')).toBeVisible()
    await expect(page.getByTestId('header-mobile-logout-button')).toBeVisible()
    // The language selector is the one preference that stays on the bar at
    // every width — not duplicated inside the panel.
    await expect(page.getByTestId('language-selector')).toHaveCount(1)

    // 07 — the mobile menu panel (MenuCelular.png).
    await page.screenshot({ path: evidence('07-menu-celular') })
    await expectNoHorizontalScroll(page)
  })

  test('keeps the contact email fully visible and clickable at the bottom of the page', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')

    await page.getByTestId('footer-contact-email').scrollIntoViewIfNeeded()
    const email = page.getByTestId('footer-contact-email')
    await expect(email).toBeVisible()
    await expect(email).toHaveAttribute('href', 'mailto:ligadealgoritmos@gmail.com')

    const box = await email.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('expected the contact link and viewport to be laid out')
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)

    // 08 — scrolled to the bottom, contact still fully on screen.
    await page.screenshot({ path: evidence('08-rodape-contato-celular') })
    await expectNoHorizontalScroll(page)
  })

  test('shows only public nav, theme and bug report for an anonymous visitor', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/login')
    await expectNoHorizontalScroll(page)

    await page.getByTestId('header-mobile-menu-trigger').click()
    // Scoped to the open panel: the desktop copies of login/signup share
    // these testids and stay in the DOM (just CSS-hidden by `hidden
    // md:flex`), which getByTestId does not filter out on its own.
    const panel = page.getByRole('dialog')
    await expect(panel.getByTestId('header-login-link')).toBeVisible()
    await expect(panel.getByTestId('header-signup-link')).toBeVisible()
    await expect(page.getByTestId('header-mobile-theme-toggle')).toBeVisible()
    await expect(page.getByTestId('header-mobile-bug-report-trigger')).toBeVisible()
    await expect(page.getByTestId('header-mobile-user-block')).toHaveCount(0)

    // 09 — anonymous mobile panel.
    await page.screenshot({ path: evidence('09-menu-celular-anonimo') })
  })
})

test.describe('header — organizer nav (#217)', () => {
  test.skip(!hasOrganizerCredentials, 'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD')

  test('shows the organizer link for an organizer, on both breakpoints', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)

    await expect(page.getByTestId('header-organizer-link')).toBeVisible()

    await page.setViewportSize(MOBILE)
    await expectNoHorizontalScroll(page)
    await page.getByTestId('header-mobile-menu-trigger').click()
    // Scoped to the open panel: the desktop copy shares this testid and
    // stays in the DOM (just CSS-hidden by `hidden md:flex`).
    await expect(page.getByRole('dialog').getByTestId('header-organizer-link')).toBeVisible()

    // 10 — the organizer's mobile panel, with the organizer row present.
    await page.screenshot({ path: evidence('10-menu-celular-organizador') })
  })
})
