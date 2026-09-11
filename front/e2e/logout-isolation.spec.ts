import { expect, type Page, test } from '@playwright/test'

import { dragBlockFromFlyout } from './support/blockly'
import {
  BACK_URL,
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  PARTICIPANT_PASSWORD,
  seedEditorFixture,
  seedParticipant,
} from './support/editor-fixture'
import { createTeamThroughUi } from './support/teams-ui'

// #175 — what one user leaves behind in the browser must not reach the next
// one. Two findings of the 2026-09-10 diagnosis, same root cause in two
// layers:
//
//   - #2  the saved Blockly workspace is keyed by problem id alone, so the
//         next account on the same browser opens the previous account's blocks;
//   - #19 `clearSession` never clears the React Query cache, so the next
//         account renders the previous one's teams/rounds/rankings until a
//         background refetch replaces them.
//
// Both accounts log in through the real form on purpose: seeding the token
// with `addInitScript` (what every other editor spec does) would re-inject
// Aluno 1's token on each later navigation, quietly undoing the very logout
// this spec is built around.
const evidence = (name: string) => `e2e/evidence/175/${name}.png`

test.describe('what survives a logout in the same browser (#175)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let alunoUmEmail: string
  let alunoDoisEmail: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    ;({ problemId } = await seedEditorFixture('Logout Isolation'))
    // Both accounts are seeded here rather than reusing the fixture's own, so
    // each carries a display name of its own: the header is what tells a
    // reviewer which of the two is looking at the screenshot.
    ;({ email: alunoUmEmail } = await seedParticipant('Logout Isolation Aluno 1', 'Aluno 1'))
    ;({ email: alunoDoisEmail } = await seedParticipant('Logout Isolation Aluno 2', 'Aluno 2'))
  })

  /**
   * Fills the login form already on screen and waits for the app to come back
   * with *this* account on the header — which is also what pins the identity
   * in the evidence screenshots.
   */
  async function submitLogin(page: Page, email: string, name: string): Promise<void> {
    await page.getByTestId('login-email-input').fill(email)
    await page.getByTestId('login-password-input').fill(PARTICIPANT_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(name)
  }

  /** Reaches /login with a full document load. */
  async function loginFromCold(page: Page, email: string, name: string): Promise<void> {
    await page.goto('/login')
    await submitLogin(page, email, name)
  }

  /**
   * Same, but never leaving the SPA. The #19 leak lives in the `queryClient`
   * built at module scope in `main.tsx`, so *any* document load — a `goto`
   * included — throws the previous user's cache away and hides the very bug
   * under test. Reaching the form through the header link keeps the same JS
   * context alive, which is what a real user clicking "Entrar" does too.
   */
  async function loginWithoutReload(page: Page, email: string, name: string): Promise<void> {
    await page.getByTestId('header-login-link').click()
    await submitLogin(page, email, name)
  }

  async function logoutThroughUi(page: Page): Promise<void> {
    await page.getByTestId('header-logout-button').click()
    await expect(page.getByTestId('header-login-link')).toBeVisible()
  }

  test('the next account does not inherit the previous one saved blocks (#2)', async ({ page }) => {
    // Two logins and two Blockly injections in one test; the 30s default is a
    // budget for neither (every editor spec raises it the same way).
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS * 2)
    const host = page.getByTestId('blockly-workspace')

    // Aluno 1 builds something and lets the debounced auto-save land.
    await loginFromCold(page, alunoUmEmail, 'Aluno 1')
    await page.goto(`/problem/${problemId}`)
    await dragBlockFromFlyout(page, 'Matemática')
    await expect(host.locator('g.blocklyDraggable:visible')).toHaveCount(2)
    await page.waitForTimeout(600)
    await page.screenshot({ path: evidence('01-aluno1-blocos-montados') })

    await logoutThroughUi(page)

    // Aluno 2 takes the same browser and opens the same problem. The only
    // block on the canvas must be the root one `withRootBlock` seeds.
    await loginWithoutReload(page, alunoDoisEmail, 'Aluno 2')
    await page.goto(`/problem/${problemId}`)
    // Injecting Blockly a second time in the same run can outlast the 30s
    // `expect` default on a cold dev server (its module graph is transformed
    // on demand); waiting longer here is cheaper than a flake that looks like
    // the very leak under test.
    await expect(host.locator('svg.blocklySvg')).toBeVisible({ timeout: 60_000 })
    await expect(host.locator('g.blocklyDraggable:visible')).toHaveCount(1)
    await page.screenshot({ path: evidence('03-aluno2-canvas-vazio') })
  })

  test('the next account does not render the previous one cached data (#19)', async ({ page }) => {
    const teamName = `Time do Aluno 1 ${Date.now()}`

    // Aluno 1 creates a distinctive team, which warms the `['teams']` cache
    // entry with a payload carrying his own `myTeamId`.
    await loginFromCold(page, alunoUmEmail, 'Aluno 1')
    await page.getByTestId('header-teams-link').click()
    await createTeamThroughUi(page, teamName)
    await expect(page.getByTestId('my-team-name')).toContainText(teamName)
    await page.screenshot({ path: evidence('02-aluno1-time-visivel') })

    await logoutThroughUi(page)

    // Without a deliberate delay the refetch lands too fast to observe: the
    // leak is real either way, but the assertion would be a race. Holding the
    // API's `GET /teams` for 2s makes the window deterministic — a clean cache
    // has nothing to paint and shows `teams-loading`, a dirty one paints
    // Aluno 1's team straight away. The pattern targets the back origin, not
    // the SPA's own `/teams` document.
    await page.route(`${BACK_URL}/teams`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.continue()
    })

    // From here to the assertion there is no document load on purpose — see
    // `loginWithoutReload`.
    await loginWithoutReload(page, alunoDoisEmail, 'Aluno 2')
    await page.getByTestId('header-teams-link').click()

    await expect(page.getByTestId('teams-loading')).toBeVisible()
    await expect(page.getByTestId('my-team-name')).toHaveCount(0)
    await page.screenshot({ path: evidence('04-aluno2-sem-cache-do-aluno1') })
  })
})
