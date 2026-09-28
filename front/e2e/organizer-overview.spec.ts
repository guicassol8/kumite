import type { Page } from '@playwright/test'

import {
  BACK_URL,
  closeRound,
  createRound,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
  withRoundLock,
} from './support/rounds'

// Visual walkthrough for #54. Prereqs (like organizer-rounds.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment.
const evidence = (name: string) => `e2e/evidence/54/${name}.png`

// Signups and team names are unique event-wide and the dev DB is shared
// across worktrees and reruns (same reasoning as organizer-team-moderation),
// so every fixture carries a stamp.
const stamp = Date.now()
const PARTICIPANT_PASSWORD = 'supersecret'

test.describe('organizer overview', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
  }

  // The overview's first criterion is about real numbers, so the walkthrough
  // seeds a population before opening it: an all-zero panel would show the
  // cards render, not that they count correctly.
  async function apiSignupAndLogin(email: string, code: string): Promise<string> {
    await fetch(`${BACK_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Participante',
        email,
        password: PARTICIPANT_PASSWORD,
        code,
      }),
    })
    const res = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PARTICIPANT_PASSWORD }),
    })
    const { token } = (await res.json()) as { token: string }
    return token
  }

  async function apiCreateTeam(token: string, name: string): Promise<string> {
    const res = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    })
    const { id } = (await res.json()) as { id: string }
    return id
  }

  async function apiJoinTeam(token: string, teamId: string): Promise<void> {
    await fetch(`${BACK_URL}/teams/${teamId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  async function apiSubmitSolution(token: string, problemId: string, roundId: string) {
    await fetch(`${BACK_URL}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        problemId,
        roundId,
        workspace: {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'kumite_solve',
                id: 'raiz',
                inputs: { RETURN: { block: { type: 'kumite_input', id: 'entrada' } } },
              },
            ],
          },
        },
      }),
    })
  }

  async function seedPublishedProblem(title: string): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy', points: 10 }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [4, 5], expected: 9, hidden: true },
        ],
        translations: [
          { locale: 'pt', title, statementMd: `Resolva ${title}.` },
          { locale: 'es', title, statementMd: `Resuelve ${title}.` },
          { locale: 'en', title, statementMd: `Solve ${title}.` },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  async function seedRound(name: string, problemId: string): Promise<string> {
    return createRound(await organizerAuthHeader(), {
      name,
      durationMinutes: 20,
      problemIds: [problemId],
    })
  }

  test('shows the event numbers, the live round and the last closed round', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    await loginAsOrganizer(page)
    const problemId = await seedPublishedProblem('Soma de dois números')

    // Three participants — two PUCRS, one Mérida — with two of them sharing a
    // team, so every counter on the panel has something to report: 3
    // inscritos split 2/1 by university, 1 team, 2 in it and 1 without.
    const pucrsA = await apiSignupAndLogin(`overview-pucrs-a-${stamp}@edu.pucrs.br`, 'PUCRS2026')
    const pucrsB = await apiSignupAndLogin(`overview-pucrs-b-${stamp}@edu.pucrs.br`, 'PUCRS2026')
    // Each code only accepts its own university's email domains.
    await apiSignupAndLogin(`overview-merida-${stamp}@merida.edu.mx`, 'MERIDA2026')
    const teamId = await apiCreateTeam(pucrsA, `Overview Squad ${stamp}`)
    await apiJoinTeam(pucrsB, teamId)

    // 01/02 — the counters are event-wide totals, so they only ever read 3
    // inscritos / 1 time on a database this suite has not run against before
    // (#150). Steps 01 and 02 assert the card wiring against a fixed payload;
    // step 03 onwards goes back to the live API. The shape below is the one
    // `organizer.index.test.tsx` covers against the real schema.
    const statsApiUrl = `${BACK_URL}/organizer/stats`
    await page.route(statsApiUrl, (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          participants: { total: 3, pucrs: 2, merida: 1, inTeam: 2, withoutTeam: 1 },
          teams: { total: 1, openSlots: 1, maxTeamSize: 3 },
          submissions: { total: 0, inRound: null },
          round: { active: null, lastClosed: null },
        }),
      })
    })
    await page.goto('/organizer')
    await expect(page.getByTestId('overview-heading')).toBeVisible()
    await expect(page.getByTestId('overview-signups-total')).toHaveText('3')
    await expect(page.getByTestId('overview-signups-pucrs')).toContainText('2')
    await expect(page.getByTestId('overview-signups-merida')).toContainText('1')
    await expect(page.getByTestId('overview-teams-total')).toHaveText('1')
    await expect(page.getByTestId('overview-teams-members')).toContainText('2 de 3')
    await expect(page.getByTestId('overview-teams-without-team')).toContainText('1')
    await expect(page.getByTestId('overview-submissions-card')).toBeVisible()
    await page.screenshot({ path: evidence('01-overview-numbers'), fullPage: true })

    // 02 — with no round announced yet, the round card says so.
    await expect(page.getByTestId('overview-round-none')).toBeVisible()
    await page.screenshot({ path: evidence('02-round-card-empty'), fullPage: true })
    await page.unroute(statsApiUrl)
    await page.reload()

    // 03 — an open round: the card names it and runs the countdown, pushed
    // live over /sse without a reload (Acceptance #2).
    const roundId = await seedRound(`Rodada Overview ${stamp}`, problemId)
    await roundSlot.open(auth, roundId)
    await expect(page.getByTestId('overview-round-name')).toContainText(`Rodada Overview ${stamp}`)
    // Scoped to the round card: the header (#217) renders its own
    // round-countdown chip whenever a round is open.
    await expect(
      page.getByTestId('overview-round-card').getByTestId('round-countdown'),
    ).toBeVisible()
    await page.screenshot({ path: evidence('03-round-open-timer'), fullPage: true })

    // 04 — a team submits while the round runs. The page is never reloaded:
    // the judged submission is announced as ranking.updated over /sse and the
    // card counts up on its own — the live half of Acceptance #2.
    await expect(page.getByTestId('overview-submissions-in-round')).toContainText('0 nesta rodada')
    // The total is event-wide and counts every earlier run's submissions too,
    // so it is asserted as a delta. `inRound` above is already scoped to the
    // round this spec just opened, and stays absolute.
    const submissionsTotal = page.getByTestId('overview-submissions-total')
    const totalBefore = Number((await submissionsTotal.textContent()) ?? '0')
    await apiSubmitSolution(pucrsA, problemId, roundId)
    await expect(page.getByTestId('overview-submissions-in-round')).toContainText('1 nesta rodada')
    await expect(submissionsTotal).toHaveText(String(totalBefore + 1))
    await page.screenshot({ path: evidence('04-submissions-in-round'), fullPage: true })

    // 05 — once closed, the card falls back to the last closed round, its
    // closing time and the podium of the teams that actually attempted it
    // (Acceptance #3). "The last closed round" is event-wide, so the close and
    // the read of the card are one critical section: another worker closing a
    // round in between would put its own name, podium and count on this card
    // (#150).
    await withRoundLock(async () => {
      await closeRound(auth, roundId)
      await expect(page.getByTestId('overview-round-name')).toContainText(
        `Rodada Overview ${stamp}`,
      )
      await expect(page.getByTestId('overview-round-closed-at')).toBeVisible()
      await expect(page.getByTestId('overview-round-podium')).toContainText(
        `Overview Squad ${stamp}`,
      )
      // The count keeps the same number, now labelled as the last round's.
      await expect(page.getByTestId('overview-submissions-in-round')).toContainText(
        '1 na última rodada',
      )
      await page.screenshot({ path: evidence('05-last-closed-round'), fullPage: true })
    })

    // 06 — the shortcuts card reaches the other panel screens.
    await page.getByTestId('overview-shortcuts-rounds').click()
    await expect(page).toHaveURL(/\/organizer\/rounds$/)
    await page.screenshot({ path: evidence('06-shortcut-to-rounds'), fullPage: true })
  })

  // #279: the live card, against the real process. Every number on it is
  // process-wide and other workers share the back, so each is asserted as a
  // lower bound, never an exact value.
  test('shows the live card: SSE connections, submissions per minute, polled every 5 s', async ({
    page,
    roundSlot,
  }) => {
    const liveEvidence = (name: string) => `e2e/evidence/279/${name}.png`
    const liveUrl = `${BACK_URL}/organizer/stats/live`
    const isLivePoll = (res: { url: () => string; ok: () => boolean }) =>
      res.url() === liveUrl && res.ok()
    const numberIn = async (testId: string) =>
      Number((await page.getByTestId(testId).textContent()) ?? 'NaN')

    const auth = await organizerAuthHeader()
    const problemId = await seedPublishedProblem(`Ao vivo ${stamp}`)
    const participant = await apiSignupAndLogin(`overview-live-${stamp}@edu.pucrs.br`, 'PUCRS2026')
    await apiCreateTeam(participant, `Live Squad ${stamp}`)
    const roundId = await seedRound(`Rodada Ao Vivo ${stamp}`, problemId)
    await roundSlot.open(auth, roundId)

    await loginAsOrganizer(page)
    await page.goto('/organizer')
    const card = page.getByTestId('overview-live-card')
    await expect(card).toBeVisible()
    await expect(page.getByTestId('overview-live-judge-concurrency')).toBeVisible()
    await expect(page.getByTestId('overview-live-sparkline')).toBeVisible()

    // The page's own /sse stream is one of the connections. The first poll
    // may land before the stream opens, so the next one is what counts.
    await expect.poll(() => numberIn('overview-live-sse-connections')).toBeGreaterThanOrEqual(1)

    // A real submission, accepted into the open round, shows up within a poll.
    await apiSubmitSolution(participant, problemId, roundId)
    await expect
      .poll(() => numberIn('overview-live-submissions-last-minute'))
      .toBeGreaterThanOrEqual(1)

    // Polling, not a one-off read: two consecutive answers, about 5 s apart.
    await page.waitForResponse(isLivePoll)
    const firstAt = Date.now()
    await page.waitForResponse(isLivePoll)
    expect(Date.now() - firstAt).toBeGreaterThanOrEqual(4_000)

    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: liveEvidence('01-live-card-pt'), fullPage: true })

    for (const [language, file] of [
      ['es', '02-live-card-es'],
      ['en', '03-live-card-en'],
    ] as const) {
      await page.getByTestId(`language-option-${language}`).click()
      await expect(page.getByTestId(`language-option-${language}`)).toHaveAttribute(
        'aria-current',
        'true',
      )
      await page.screenshot({ path: liveEvidence(file), fullPage: true })
    }
    await page.getByTestId('language-option-pt').click()

    // Phone width: the four blocks stack and nothing scrolls sideways.
    await page.setViewportSize({ width: 390, height: 844 })
    await card.scrollIntoViewIfNeeded()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: liveEvidence('04-live-card-phone'), fullPage: true })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.evaluate(() => localStorage.setItem('kumite:theme', 'dark'))
    await page.reload()
    await expect(page.getByTestId('overview-live-sse-connections')).toBeVisible()
    await page.screenshot({ path: liveEvidence('05-live-card-dark'), fullPage: true })
    await page.evaluate(() => localStorage.removeItem('kumite:theme'))
  })
})
