import { expect, test } from '@playwright/test'

import {
  BACK_URL,
  hasOrganizerCredentials,
  seedParticipant,
  seedParticipantToken,
} from './support/editor-fixture'
import { organizerAuthHeader } from './support/rounds'
import { retryRounds } from './support/sse'

// Repro + visual walkthrough for #291: when an organizer deactivates an
// account with a live `/sse` stream, the back now ends that stream with an
// explicit `session.revoked` frame. Before it, the clean end looked exactly
// like a network drop — the board showed "reconnecting" for 2s and only the
// reconnect's 401 (#326) finally sent the user to /login.
//
// Prereqs (like sse-401-zombie-session.spec.ts): a migrated + seeded db. The
// first test needs nothing else; the second needs ORGANIZER_EMAIL /
// ORGANIZER_PASSWORD to deactivate the account through the real API.
const evidence = (name: string) => `e2e/evidence/291/${name}.png`

const TOKEN_KEY = 'kumite-token'

// Mirrors SSE_RETRY_DELAY_MS in src/lib/sse-client.ts: the delay the old
// client waited before the reconnect whose 401 got it to /login.
const SSE_RETRY_DELAY_MS = 2_000

// Long enough to hold several of the old 2s reconnects, so "exactly one
// round" cannot pass by the window simply being too short to see a second.
const WATCH_MS = 6_000

function sseFrame(event: unknown): string {
  return `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`
}

test.describe('session.revoked on /sse (#291)', () => {
  test('goes to /login at once and never reconnects', async ({ page }) => {
    const { token } = await seedParticipant('SSE Session Revoked')
    await seedParticipantToken(page, token)

    // What the back now writes to a deactivated account's stream: the snapshot,
    // then the terminal frame, then the end. Served again on every request, so
    // a client that still read the end as a drop would keep reconnecting here
    // instead of being rescued by a 401.
    const attempts: number[] = []
    await page.route('**/sse', async (route) => {
      attempts.push(Date.now())
      const serverTime = new Date().toISOString()
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body:
          sseFrame({ type: 'state.sync', serverTime, round: null }) +
          sseFrame({ type: 'session.revoked', serverTime }),
      })
    })

    await page.goto('/leaderboard')

    // 01 — the login screen, saying the session ended, with the token gone.
    await expect(page).toHaveURL(/\/login\?.*notice=expired/)
    await expect(page.getByTestId('login-expired-notice')).toBeVisible()
    expect(await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)).toBeNull()
    await page.screenshot({ path: evidence('01-login-apos-session-revoked'), fullPage: true })

    // Terminal: counted, not inferred. The old client would have reconnected
    // every 2s against this handler for as long as the tab lived.
    await page.waitForTimeout(WATCH_MS)
    expect(retryRounds(attempts)).toHaveLength(1)
  })

  test('an organizer deactivation sends the participant to /login within the old retry delay', async ({
    page,
  }) => {
    test.skip(!hasOrganizerCredentials, 'needs ORGANIZER_EMAIL / ORGANIZER_PASSWORD')

    const participant = await seedParticipant('SSE Session Revoked Live')
    await seedParticipantToken(page, participant.token)

    const sseRequests: number[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/sse') sseRequests.push(Date.now())
    })

    const streamOpen = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/sse' && response.status() === 200,
    )
    await page.goto('/leaderboard')
    await streamOpen
    await expect(page.getByTestId('leaderboard-connection-banner')).toBeHidden()
    // StrictMode's twin connection is aborted within a few ms; let it settle so
    // the stream the organizer's ban lands on is the one that stays.
    await page.waitForTimeout(1_000)
    await page.screenshot({ path: evidence('02-placar-antes-da-desativacao'), fullPage: true })

    const auth = await organizerAuthHeader()
    const deactivatedAt = Date.now()
    const res = await fetch(`${BACK_URL}/organizer/users/${participant.id}/deactivate`, {
      method: 'POST',
      headers: auth,
    })
    expect(res.status).toBe(200)

    await expect(page).toHaveURL(/\/login\?.*notice=expired/, { timeout: SSE_RETRY_DELAY_MS })
    const redirectedAfterMs = Date.now() - deactivatedAt
    await expect(page.getByTestId('login-expired-notice')).toBeVisible()
    await page.screenshot({ path: evidence('03-login-apos-desativacao'), fullPage: true })

    // No reconnect at all after the ban — not even the single one #326's path
    // spent to discover the 401.
    await page.waitForTimeout(WATCH_MS)
    expect(sseRequests.filter((at) => at >= deactivatedAt)).toEqual([])
    expect(redirectedAfterMs).toBeLessThan(SSE_RETRY_DELAY_MS)
  })
})
