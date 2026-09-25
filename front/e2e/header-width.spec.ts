import type { Page } from '@playwright/test'

import {
  BACK_URL,
  createRound,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// #297 — at exactly 768px the header flips to its desktop layout and has to
// fit, in all three catalogs, for both roles, with and without a live round.
// jsdom does no layout, so this is the only place the criterion can be
// settled: the probe below is the one that found the bug while reviewing
// #223, and it reports the offending elements so a failure says *what* is
// sticking out, not only that something is.
//
// The matrix the issue never measured is the point of this spec. #223's probe
// ran with no round open (`grep -c createRound` → 0) and in pt/es only, so
// 791/827 were the *easy* case: the live-round chip adds a free-text round
// name and, before this issue, a whole sentence ("Termina em 41:23") where
// identity § 5 asks for a numeral.
// Every screenshot below is taken right after `switchLanguage`, and the
// segmented control's buttons carry shadcn's `transition-all`. Without
// `animations: 'disabled'` the capture races that transition and the evidence
// shows the *previous* language still lit — the PNG then contradicts the
// assertion the same line just made. Playwright fast-forwards transitions to
// their finished state instead of merely freezing them (found reviewing #304).
const evidence = (name: string) => `e2e/evidence/297/${name}.png`

// `size.breakpoint-cards`: the first width that gets the desktop bar, so the
// least room it will ever have.
const BREAKPOINT = { width: 768, height: 1024 }
// `lg`: the width where the round name comes back onto the bar (#297, Q2), so
// the tightest width that has to carry it.
const COMPACT_TOP = { width: 1024, height: 900 }
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const LANGUAGES = ['pt', 'es', 'en'] as const

// Identity § 5's closed inventory for >= 768px. Language, theme and Sair stay
// ON the bar — the fix is allowed to compress them, never to move them into
// the user menu.
const BAR_INVENTORY = [
  'header-teams-link',
  'header-leaderboard-link',
  'header-practice-link',
  'header-bug-report-trigger',
  'header-user-menu-trigger',
  'header-logout-button',
  'language-selector',
  'header-theme-toggle',
] as const

const PASSWORD = 'supersecret'
const stamp = Date.now()

// Free text an organizer types into a form; nothing bounds it but the 120-char
// column, so the chip has to have a ceiling of its own.
const LONG_ROUND_NAME = 'Rodada Eliminatória Semifinal PUCRS × Mérida'
// 36 characters, inside the 80 the signup schema allows: the user-menu trigger
// is the one elastic thing on the bar, and § 5 says it truncates.
const LONG_PARTICIPANT_NAME = 'Maria Fernanda Villanueva del Carmen'

type Measurement = { width: number; scrollWidth: number; offenders: string[] }

/**
 * Identity § 5: horizontal scroll is never the answer to overflow. The
 * `offenders` list is diagnostic only — it goes into the failure message,
 * because "scrollWidth is 827" alone has never told anyone which element to
 * fix.
 */
async function measure(page: Page): Promise<Measurement> {
  await page.evaluate(() => document.fonts.ready)
  return page.evaluate(() => {
    const width = window.innerWidth
    return {
      width,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: Array.from(document.body.querySelectorAll('*'))
        .filter((node) => node.getBoundingClientRect().right > width + 0.5)
        .slice(0, 8)
        .map((node) => {
          const element = node as HTMLElement
          const rect = element.getBoundingClientRect()
          const testId = element.dataset.testid ? `[${element.dataset.testid}]` : ''
          return `${element.tagName}${testId} w=${Math.round(rect.width)} right=${Math.round(rect.right)} class="${element.getAttribute('class') ?? ''}"`
        }),
    }
  })
}

/**
 * Prints the number so the PR's Evidence carries a measurement, not a claim.
 *
 * Soft on purpose: a hard assertion stops at the first language and hides the
 * other five cells, and the whole point of this spec is the matrix. The test
 * still fails — Playwright fails it at the end, with every cell reported.
 */
async function expectFits(page: Page, label: string): Promise<Measurement> {
  const result = await measure(page)
  console.log(
    `[297] ${label.padEnd(44)} innerWidth=${result.width} scrollWidth=${result.scrollWidth}`,
  )
  expect
    .soft(
      result.scrollWidth,
      `${label} — the page scrolls sideways; crossing the viewport edge:\n  ${
        result.offenders.join('\n  ') || '(none — the overflow is a descendant that was clipped)'
      }`,
    )
    .toBeLessThanOrEqual(result.width)
  return result
}

async function switchLanguage(page: Page, language: (typeof LANGUAGES)[number]) {
  // PT included: the selector persists the choice, so an early return would
  // leave the page in whatever language the previous iteration ended on.
  await page.getByTestId(`language-option-${language}`).click()
  await expect(page.getByTestId(`language-option-${language}`)).toHaveAttribute(
    'aria-current',
    'true',
  )
}

async function loginToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const { token } = (await res.json().catch(() => ({}))) as { token?: string }
  if (!token) throw new Error(`login failed for ${email} (HTTP ${res.status})`)
  return token
}

/** Signs a participant up through the API and returns their session token. */
async function participantToken(email: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: LONG_PARTICIPANT_NAME,
      email,
      password: PASSWORD,
      code: 'PUCRS2026',
    }),
  })
  if (!res.ok) throw new Error(`could not sign ${email} up (HTTP ${res.status})`)
  return loginToken(email, PASSWORD)
}

/**
 * Swaps the session without a fresh context: the token lives in
 * `localStorage`, and `addInitScript` would keep re-installing the previous
 * role's token on every reload.
 */
async function signInAs(page: Page, token: string, route: string) {
  await page.goto('/')
  await page.evaluate((value) => localStorage.setItem('kumite-token', value), token)
  await page.goto(route)
}

/** A published problem is the only thing a round cannot be created without. */
async function publishProblem(auth: Record<string, string>): Promise<string> {
  const created = await fetch(`${BACK_URL}/organizer/problems`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ difficulty: 'easy' }),
  })
  const { id } = (await created.json()) as { id: string }
  await fetch(`${BACK_URL}/organizer/problems/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({
      translations: [
        { locale: 'pt', title: 'Soma', statementMd: 'Some os números.' },
        { locale: 'es', title: 'Suma', statementMd: 'Suma los números.' },
        { locale: 'en', title: 'Sum', statementMd: 'Sum the numbers.' },
      ],
      testCases: [
        { input: [1, 2], expected: 3, hidden: false },
        { input: [4, 5], expected: 9, hidden: true },
      ],
    }),
  })
  await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
  return id
}

test.describe('header width at the 768px breakpoint (#297)', () => {
  test.skip(!hasOrganizerCredentials, 'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD')

  test('organizer: the bar fits at 768px in pt/es/en, whole inventory on it', async ({ page }) => {
    await page.setViewportSize(BREAKPOINT)
    await signInAs(page, await loginToken(ORGANIZER_EMAIL, ORGANIZER_PASSWORD), '/organizer/users')
    await expect(page.getByTestId('header-organizer-link')).toBeVisible()

    for (const language of LANGUAGES) {
      await switchLanguage(page, language)
      // Acceptance #3: § 5's closed inventory is still ON the bar, not folded
      // into a menu — organizers also get the extra nav link.
      await expect(page.getByTestId('header-organizer-link')).toBeVisible()
      for (const testId of BAR_INVENTORY) await expect(page.getByTestId(testId)).toBeVisible()
      await expectFits(page, `organizer /organizer/users ${language} (no round)`)
      await page.screenshot({
        path: evidence(`01-organizador-768-${language}`),
        fullPage: true,
        animations: 'disabled',
      })
    }
    await switchLanguage(page, 'pt')
  })

  test('participant: the bar fits at 768px in pt/es/en, long name truncated', async ({ page }) => {
    await page.setViewportSize(BREAKPOINT)
    await signInAs(page, await participantToken(`header-297-${stamp}@edu.pucrs.br`), '/teams')
    await expect(page.getByTestId('header-user-menu-trigger')).toBeVisible()
    // A participant has no organizer link; everything else on the bar is the
    // same closed inventory.
    await expect(page.getByTestId('header-organizer-link')).toHaveCount(0)

    for (const language of LANGUAGES) {
      await switchLanguage(page, language)
      for (const testId of BAR_INVENTORY) await expect(page.getByTestId(testId)).toBeVisible()
      await expectFits(page, `participant /teams ${language} (no round)`)
      await page.screenshot({
        path: evidence(`02-participante-768-${language}`),
        fullPage: true,
        animations: 'disabled',
      })
    }
    await switchLanguage(page, 'pt')
  })

  test('with a live round the chip fits too, for both roles, in pt/es/en', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problemId = await publishProblem(auth)
    const roundId = await createRound(auth, {
      name: LONG_ROUND_NAME,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    const participant = await participantToken(`header-297-round-${stamp}@edu.pucrs.br`)
    const organizer = await loginToken(ORGANIZER_EMAIL, ORGANIZER_PASSWORD)

    await roundSlot.open(auth, roundId)

    // Two tight widths, not one. 768 is the issue's; 1024 is the one this fix
    // creates, because that is where the round name comes back — the bar is
    // 256px wider there but has to carry a name of up to 240px, so it is the
    // second-worst case and would otherwise go unmeasured.
    for (const viewport of [BREAKPOINT, COMPACT_TOP]) {
      await page.setViewportSize(viewport)

      for (const [role, token, route] of [
        ['organizer', organizer, '/organizer/users'],
        ['participant', participant, '/teams'],
      ] as const) {
        await signInAs(page, token, route)
        const chip = page.getByTestId('header-round-chip')
        await expect(chip).toBeVisible()
        // The chip keeps the dot and the timer at every desktop width: § 5's
        // "ao vivo" role is what must survive the compression, and a bar that
        // fits only because the live round vanished is not a fix. Asserting
        // *visible* is what catches that — flexbox is perfectly willing to
        // squeeze a flexible item to zero and report a tidy 768.
        await expect(chip.getByTestId('round-countdown')).toBeVisible()

        for (const language of LANGUAGES) {
          await switchLanguage(page, language)
          for (const testId of BAR_INVENTORY) await expect(page.getByTestId(testId)).toBeVisible()
          await expect(chip).toBeVisible()
          const box = await chip.boundingBox()
          expect(
            box?.width ?? 0,
            `${role} ${language} @${viewport.width} — the chip collapsed`,
          ).toBeGreaterThan(24)
          // Identity § 5, amended by this issue: the name is gone on the
          // compact band and back from 1024 up. The dot and the timer stay.
          // By testid, not by text: `round-countdown-summary` (sr-only) also
          // contains the round name, on purpose, and matching on text picks
          // up both.
          const name = chip.getByTestId('header-round-name')
          await expect(name).toHaveText(LONG_ROUND_NAME)
          if (viewport.width >= 1024) await expect(name).toBeVisible()
          else await expect(name).toBeHidden()
          await expectFits(page, `${role} ${route} ${language} @${viewport.width} (round open)`)
          await page.screenshot({
            path: evidence(`03-${role}-rodada-${viewport.width}-${language}`),
            fullPage: true,
            animations: 'disabled',
          })
        }
        await switchLanguage(page, 'pt')
      }
    }
  })

  test('non-regression: the phone panel and the 1280px bar are untouched', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problemId = await publishProblem(auth)
    const roundId = await createRound(auth, {
      name: LONG_ROUND_NAME,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    const token = await loginToken(ORGANIZER_EMAIL, ORGANIZER_PASSWORD)

    await page.setViewportSize(DESKTOP)
    await roundSlot.open(auth, roundId)
    await signInAs(page, token, '/organizer/users')

    // Above `lg` the round name is back, whole — this is what #217's own spec
    // asserts at 1280x800, and it must keep passing.
    //
    // By testid, for the same reason the compact-band test gives above:
    // `round-countdown-summary` (sr-only) carries the round name too, so
    // `toContainText` on the chip passes even with the visible name gone from
    // the bar — which is the only thing this cell exists to catch. Verified by
    // mutation while reviewing #304: pinning the name to `hidden` at every
    // width left both this test and #217's green.
    const chip = page.getByTestId('header-round-chip')
    await expect(chip).toBeVisible()
    const name = chip.getByTestId('header-round-name')
    await expect(name).toBeVisible()
    await expect(name).toHaveText(LONG_ROUND_NAME)
    await expectFits(page, 'organizer 1280x800 (round open)')
    await page.screenshot({
      path: evidence('04-desktop-1280-nome-da-rodada'),
      fullPage: true,
      animations: 'disabled',
    })

    // Below 768 the bar is the phone layout: lockup + language + menu button.
    await page.setViewportSize(PHONE)
    await page.reload()
    await expect(page.getByTestId('header-mobile-menu-trigger')).toBeVisible()
    await expectFits(page, 'organizer 390x844 (round open)')
    await page.screenshot({
      path: evidence('05-celular-390'),
      fullPage: true,
      animations: 'disabled',
    })
  })
})
