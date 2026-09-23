import { expect, test } from '@playwright/test'

import { seedParticipant, seedParticipantToken } from './support/editor-fixture'
import { retryRounds } from './support/sse'

// Repro + visual walkthrough for #189: the `/sse` stream answers 401 (the
// token expired while the venue's big screen sat open for hours) and the app
// used to call that connection 'open'. The error envelope is a body, so
// `res.body.getReader()` succeeded and the client announced success before
// ever looking at the status — leaving the dead token in localStorage and
// hammering the API every 2s for as long as the tab lived.
//
// Prereqs (like auth.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// No organizer credentials and no round needed — `seedParticipant` only signs
// a participant up and logs them in, so this spec never joins the group that
// skips itself when ORGANIZER_EMAIL/ORGANIZER_PASSWORD are unset.
const evidence = (name: string) => `e2e/evidence/189/${name}.png`

const TOKEN_KEY = 'kumite-token'

// How long the retry window is watched in the backoff case. The schedule is
// 2s, +4s, +8s, so 12s is long enough to contain three attempts and to fall
// short of the fourth (14s) — while the old fixed 2s delay would have fired
// seven times inside it.
const WATCH_MS = 12_000

test.describe('401 on /sse (#189)', () => {
  let token = ''

  test.beforeAll(async () => {
    ;({ token } = await seedParticipant('SSE 401 Zombie'))
  })

  test('clears the session and sends the user to /login', async ({ page }) => {
    await seedParticipantToken(page, token)

    // Exactly what an expired token gets from `requireUser`: kata's error
    // envelope, with a body — the shape that used to be mistaken for a live
    // stream.
    const attempts: number[] = []
    await page.route('**/sse', async (route) => {
      attempts.push(Date.now())
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'unauthorized', message: 'token expired' } }),
      })
    })

    await page.goto('/leaderboard')

    // 01 — the session is gone and the login screen says why, instead of a
    // board that claims to be live behind a dead token.
    await expect(page).toHaveURL(/\/login/)
    await expect(page).toHaveURL(/notice=expired/)
    await expect(page.getByTestId('login-expired-notice')).toBeVisible()
    expect(await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)).toBeNull()
    await page.screenshot({ path: evidence('01-sessao-expirada-no-login'), fullPage: true })

    // And it is terminal: retrying a token the back just rejected can only
    // produce the same 401. Counted, not inferred — the old client would have
    // fired roughly six more times in this window.
    const afterRedirect = attempts.length
    await page.waitForTimeout(WATCH_MS)
    expect(attempts.length).toBe(afterRedirect)
    expect(retryRounds(attempts)).toHaveLength(1)
  })

  test('backs off instead of reconnecting every 2s on a transient failure', async ({ page }) => {
    await seedParticipantToken(page, token)

    // 503 is the back restarting or the venue's proxy refusing: retryable, so
    // the stream must keep trying — with a growing delay, not a flood.
    const attempts: number[] = []
    await page.route('**/sse', async (route) => {
      attempts.push(Date.now())
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'service_unavailable' } }),
      })
    })

    await page.goto('/leaderboard')
    await expect(page.getByTestId('header-leaderboard-link')).toBeVisible()

    // Every count below is a request this handler actually intercepted, timed
    // from the first one — nothing is derived from the delays the client is
    // supposed to be using.
    await expect.poll(() => attempts.length, { timeout: 30_000 }).toBeGreaterThan(0)
    const firstAt = attempts[0] as number
    await page.waitForTimeout(WATCH_MS)
    const rounds = retryRounds(attempts.filter((at) => at - firstAt <= WATCH_MS))

    // Before the fix: ~7 rounds in 12s, one every 2s, forever. After: the
    // three that the 2s/4s/8s schedule allows — the fourth is due at 14s.
    expect(rounds.length).toBeGreaterThanOrEqual(2)
    expect(rounds.length).toBeLessThanOrEqual(3)

    // The gaps themselves grow, which is the actual acceptance criterion.
    // Generous lower bounds: a loaded box can make a timer late, never early.
    expect((rounds[1] as number) - (rounds[0] as number)).toBeGreaterThanOrEqual(1_800)
    if (rounds.length > 2) {
      expect((rounds[2] as number) - (rounds[1] as number)).toBeGreaterThanOrEqual(3_600)
    }

    // 02 — and the screen says so the whole time: the session survives (this
    // is a network problem, not a dead token) and the board warns that it is
    // not live, which is what #180 built this banner for.
    await expect(page.getByTestId('leaderboard-connection-banner')).toBeVisible()
    expect(await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)).toBe(token)
    await page.screenshot({ path: evidence('02-backoff-sem-loop'), fullPage: true })
  })
})
