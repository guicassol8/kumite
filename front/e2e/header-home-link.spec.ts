import { expect, type Page, test } from '@playwright/test'
import { E2E_PARTICIPANT_NAME, ORGANIZER_NAME } from './support/rounds'

// The wordmark is the only way back to the home page from a deep route (#154).
// The component test already pins the markup and the label; what it cannot see
// is that the link survives real routing — that the click lands on `/` in the
// actual SPA, from an authenticated screen and from the organizer panel, and
// that the focus ring is really painted for keyboard users.

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
const PASSWORD = 'supersecret'
const stamp = Date.now()

async function signUpParticipant(page: Page, email: string) {
  await page.goto('/signup')
  await page.getByTestId('signup-name-input').fill('E2E Participante')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
  await page.getByTestId('signup-code-input').fill('PUCRS2026')
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
}

async function loginAsOrganizer(page: Page) {
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
  await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
  await page.getByTestId('login-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
}

test.describe('header home link', () => {
  test('takes an anonymous visitor from /login back to the home page', async ({ page }) => {
    await page.goto('/login')

    const link = page.getByTestId('header-home-link')
    await expect(link).toBeVisible()
    // The wordmark is the outlined lockup, aria-hidden: the accessible name
    // comes from the label alone (#216).
    await expect(link.getByTestId('brand-lockup')).toBeVisible()
    await expect(link).toHaveAttribute('href', '/')
    await expect(link).toHaveAttribute('aria-label', 'kumite — página inicial')

    await link.click()

    await expect(page).toHaveURL(/\/$/)
  })

  test('is present on every anonymous auth route', async ({ page }) => {
    for (const route of ['/signup', '/reset-password']) {
      await page.goto(route)
      await expect(page.getByTestId('header-home-link')).toBeVisible()
      await expect(page.getByTestId('header-home-link')).toHaveAttribute('href', '/')
    }
  })

  test('stays on the home page when clicked from the home page', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('header-home-link').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('header-home-link')).toBeVisible()
  })
})

// Visual walkthrough for #154, one screenshot per acceptance criterion.
const evidence = (name: string) => `e2e/evidence/154/${name}.png`

test.describe('header home link — visual walkthrough (#154)', () => {
  test('brings an anonymous visitor home from the auth routes', async ({ page }) => {
    // 01 — /login: the wordmark is a link, labelled for screen readers.
    await page.goto('/login')
    const link = page.getByTestId('header-home-link')
    await expect(link).toHaveAttribute('href', '/')
    await expect(link).toHaveAttribute('aria-label', 'kumite — página inicial')
    await page.screenshot({ path: evidence('01-login-anonimo'), fullPage: true })

    // 02 — clicking it lands on the home page, client-side.
    await link.click()
    await expect(page).toHaveURL(/\/$/)
    await page.screenshot({ path: evidence('02-login-clicou-e-voltou-pra-home'), fullPage: true })

    // 03 — /signup: same link, same target.
    await page.goto('/signup')
    await expect(page.getByTestId('header-home-link')).toHaveAttribute('href', '/')
    await page.screenshot({ path: evidence('03-signup-anonimo'), fullPage: true })

    // 04 — /reset-password: whoever cannot get in can still leave.
    await page.goto('/reset-password')
    await expect(page.getByTestId('header-home-link')).toHaveAttribute('href', '/')
    await page.screenshot({ path: evidence('04-reset-password-anonimo'), fullPage: true })
  })

  test('brings an authenticated participant home from /teams', async ({ page }) => {
    // 05 — signed in, on a deep route: the same wordmark, and it navigates.
    await signUpParticipant(page, `header-home-e2e-${stamp}@edu.pucrs.br`)
    await page.goto('/teams')
    await expect(page.getByTestId('header-home-link')).toBeVisible()
    await page.screenshot({ path: evidence('05-teams-autenticado'), fullPage: true })

    await page.getByTestId('header-home-link').click()
    await expect(page).toHaveURL(/\/$/)
    await page.screenshot({ path: evidence('06-teams-voltou-pra-home'), fullPage: true })
  })

  test('brings an organizer home from the panel', async ({ page }) => {
    test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

    // 07 — the panel is the deepest place to get stuck; the header is global,
    // so the link is there with no route-specific logic.
    await loginAsOrganizer(page)
    await page.goto('/organizer/problems')
    await expect(page.getByTestId('header-home-link')).toBeVisible()
    await page.screenshot({ path: evidence('07-organizer-problems'), fullPage: true })

    await page.getByTestId('header-home-link').click()
    await expect(page).toHaveURL(/\/$/)
    await page.screenshot({ path: evidence('08-organizer-voltou-pra-home'), fullPage: true })
  })

  test('is reachable and activatable by keyboard', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByTestId('header-home-link')

    // 09 — focused: the ring is painted, so a keyboard user can see where
    // they are. Shot of the header alone, where the ring is legible.
    await link.focus()
    await expect(link).toBeFocused()
    await page.screenshot({ path: evidence('09-anel-de-foco'), clip: await headerClip(page) })

    // 10 — Enter activates it, same as the click.
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/$/)
    await page.screenshot({ path: evidence('10-enter-navegou-pra-home'), fullPage: true })
  })

  test('translates the accessible label in pt, es and en', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByTestId('header-home-link')

    // 11 — pt, the pinned browser locale of this suite.
    await expect(link).toHaveAttribute('aria-label', 'kumite — página inicial')
    await page.screenshot({ path: evidence('11-rotulo-pt'), clip: await headerClip(page) })

    // 12 — es: the label changes, the visible wordmark does not.
    await page.getByTestId('language-option-es').click()
    await expect(link).toHaveAttribute('aria-label', 'kumite — página de inicio')
    await expect(link.getByTestId('brand-lockup')).toBeVisible()
    await page.screenshot({ path: evidence('12-rotulo-es'), clip: await headerClip(page) })

    // 13 — en, same wordmark.
    await page.getByTestId('language-option-en').click()
    await expect(link).toHaveAttribute('aria-label', 'kumite — home')
    await expect(link.getByTestId('brand-lockup')).toBeVisible()
    await page.screenshot({ path: evidence('13-rotulo-en'), clip: await headerClip(page) })
  })
})

/** The header's own box, so the focus ring is legible instead of a few pixels
 * lost in a full-page shot. */
async function headerClip(page: Page) {
  const box = await page.getByTestId('app-header').boundingBox()
  if (!box) throw new Error('expected the header to be laid out')
  return box
}
