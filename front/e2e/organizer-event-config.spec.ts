import { expect, type Page, test } from '@playwright/test'

// Visual walkthrough for #49. Prereqs (like organizer-rounds.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment.
const evidence = (name: string) => `e2e/evidence/49/${name}.png`

const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''

test.describe('organizer event config', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_EMAIL)
  }

  test('walks through mixing lock, max team size and event code edits', async ({ page }) => {
    await loginAsOrganizer(page)

    // 01 — the seeded defaults (mixingLocked: false, maxTeamSize: 3) and both
    // event codes (PUCRS2026, MERIDA2026).
    await page.goto('/organizer/event-config')
    await expect(page.getByTestId('event-config-max-team-size-input')).toHaveValue('3')
    await expect(page.getByTestId('event-config-codes-row-pucrs')).toBeVisible()
    await expect(page.getByTestId('event-config-codes-row-merida')).toBeVisible()
    await page.screenshot({ path: evidence('01-initial-state'), fullPage: true })

    // 02 — toggling the mixing lock asks for confirmation before applying.
    await page.getByTestId('event-config-mixing-switch').click()
    await expect(page.getByTestId('event-config-mixing-confirm')).toBeVisible()
    await page.screenshot({ path: evidence('02-mixing-confirm-dialog'), fullPage: true })

    await page.getByTestId('event-config-mixing-confirm-confirm').click()
    await expect(page.getByTestId('event-config-mixing-switch')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.screenshot({ path: evidence('03-mixing-locked'), fullPage: true })

    // 04 — max team size: save a new value and see the saved confirmation.
    await page.getByTestId('event-config-max-team-size-input').fill('5')
    await page.getByTestId('event-config-max-team-size-save').click()
    await expect(page.getByTestId('event-config-max-team-size-saved')).toBeVisible()
    await page.screenshot({ path: evidence('04-max-team-size-saved'), fullPage: true })

    // 05 — edit Mérida's event code: code, suffixes and active flag.
    await page.getByTestId('event-config-codes-edit-merida').click()
    await expect(page.getByTestId('event-config-codes-edit-dialog')).toBeVisible()
    await page
      .getByTestId('event-config-codes-edit-suffixes')
      .fill('merida.edu.mx\nalumnos.merida.edu.mx')
    await page.screenshot({ path: evidence('05-edit-code-dialog-filled'), fullPage: true })

    await page.getByTestId('event-config-codes-edit-save').click()
    await expect(page.getByTestId('event-config-codes-edit-dialog')).toBeHidden()
    await expect(page.getByTestId('event-config-codes-row-merida')).toContainText(
      'alumnos.merida.edu.mx',
    )
    await page.screenshot({ path: evidence('06-code-updated'), fullPage: true })

    // 07 — restore the seeded defaults so this spec is idempotent for reruns.
    await page.getByTestId('event-config-codes-edit-merida').click()
    await page.getByTestId('event-config-codes-edit-suffixes').fill('merida.edu.mx')
    await page.getByTestId('event-config-codes-edit-save').click()
    await expect(page.getByTestId('event-config-codes-edit-dialog')).toBeHidden()

    await page.getByTestId('event-config-max-team-size-input').fill('3')
    await page.getByTestId('event-config-max-team-size-save').click()
    await expect(page.getByTestId('event-config-max-team-size-saved')).toBeVisible()

    await page.getByTestId('event-config-mixing-switch').click()
    await page.getByTestId('event-config-mixing-confirm-confirm').click()
    await expect(page.getByTestId('event-config-mixing-switch')).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})
