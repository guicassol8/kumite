import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import type { InferResponseType } from 'hono'
import type { api } from '../src/lib/api'

import {
  BACK_URL,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// Visual walkthrough for #318: the organizer sees whether the Rodada tab's
// ranking is comparable between teams (the `denominators` verdict from #193).
//
// `inconsistent` can no longer be produced through the UI — the #193 guard
// refuses to edit a problem's scale mid-round — so, like
// home-teams-identity.spec.ts, the REST sources are fulfilled by `page.route`
// while authentication stays real. The rounds list holds one closed round and
// no open one, so the Rodada tab shows that round's REST ranking.
//
// `/sse` cannot stay real: a parallel spec holding a round open (e.g.
// leaderboard-offline-fallback) announces it over the stream, and the Rodada
// tab rightly switches to that live round. Nor can `page.route` serve it — a
// fulfilled body ends at once, and the reconnect loop would flash the
// "reconnecting" banner into every capture. So `stubQuietSse` answers the
// page's `/sse` fetch with a stream that says "no round open" and stays open:
// the screen is live, and quiet.
const evidence = (name: string) => `e2e/evidence/318/${name}.png`

type RoundRankingResponse = InferResponseType<(typeof api.rounds)[':id']['ranking']['$get'], 200>
type EventRankingResponse = InferResponseType<typeof api.ranking.$get, 200>
type TeamsResponse = InferResponseType<typeof api.teams.$get, 200>
type Verdict = RoundRankingResponse['denominators']

const PASSWORD = 'denominators-318-password'
const roundId = randomUUID()
const problemIds: string[] = [randomUUID(), randomUUID()]
const teamA = randomUUID()
const teamB = randomUUID()

const teamsFixture: TeamsResponse = {
  maxTeamSize: 4,
  mixingLocked: false,
  myTeamId: null,
  teams: [
    {
      id: teamA,
      name: 'Byte Fighters',
      members: [{ university: 'pucrs', name: 'Ana Souza', email: null }],
      slotsAvailable: 3,
      frozen: false,
      joinBlockedReason: null,
    },
    {
      id: teamB,
      name: 'Los Recursivos',
      members: [{ university: 'merida', name: 'Luis Pech', email: null }],
      slotsAvailable: 3,
      frozen: false,
      joinBlockedReason: null,
    },
  ],
}

function roundRanking(denominators: Verdict): RoundRankingResponse {
  return {
    roundId,
    roundName: 'Rodada 1',
    problemIds,
    denominators,
    teams: [
      {
        teamId: teamA,
        teamName: 'Byte Fighters',
        rank: 1,
        totalScore: 200,
        totalAttempts: 3,
        tiebreakTimeMs: 610_000,
        problems: [
          { problemId: problemIds[0]!, score: 100, maxScore: 100, attempts: 1 },
          { problemId: problemIds[1]!, score: 100, maxScore: 100, attempts: 2 },
        ],
      },
      {
        teamId: teamB,
        teamName: 'Los Recursivos',
        rank: 2,
        totalScore: 150,
        totalAttempts: 2,
        tiebreakTimeMs: 540_000,
        problems: [
          { problemId: problemIds[0]!, score: 100, maxScore: 100, attempts: 1 },
          { problemId: problemIds[1]!, score: 50, maxScore: 100, attempts: 1 },
        ],
      },
    ],
  }
}

const eventRanking: EventRankingResponse = {
  teams: [
    {
      teamId: teamA,
      teamName: 'Byte Fighters',
      rank: 1,
      totalScore: 200,
      totalAttempts: 3,
      tiebreakTimeMs: 610_000,
      rounds: [
        { roundId, roundName: 'Rodada 1', score: 200, attempts: 3, tiebreakTimeMs: 610_000 },
      ],
    },
    {
      teamId: teamB,
      teamName: 'Los Recursivos',
      rank: 2,
      totalScore: 150,
      totalAttempts: 2,
      tiebreakTimeMs: 540_000,
      rounds: [
        { roundId, roundName: 'Rodada 1', score: 150, attempts: 2, tiebreakTimeMs: 540_000 },
      ],
    },
  ],
}

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${BACK_URL}/auth/login`, { data: { email, password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  return token as string
}

async function participantToken(request: APIRequestContext) {
  const email = `denominators-318-${randomUUID()}@edu.pucrs.br`
  const response = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'Ana Souza', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(response.status()).toBe(201)
  return login(request, email, PASSWORD)
}

// Runs before the app on every navigation: wraps `fetch` so `/sse` gets one
// `state.sync` frame with no open round and then a body that never ends (it
// errors only when the client aborts, as a real socket would).
async function stubQuietSse(page: Page) {
  await page.addInitScript(() => {
    const realFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (new URL(url, window.location.href).pathname !== '/sse') return realFetch(input, init)
      const frame = {
        type: 'state.sync',
        serverTime: new Date().toISOString(),
        round: null,
        submissionsPaused: false,
      }
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`))
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason))
        },
      })
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      )
    }
  })
}

// Routes are registered once per page; `verdict.current` picks what the
// ranking mock answers, so a reload is all it takes to switch scenarios.
async function mockRanking(page: Page, verdict: { current: Verdict }) {
  await stubQuietSse(page)
  await page.route(`${BACK_URL}/teams`, (route) => route.fulfill({ json: teamsFixture }))
  await page.route(`${BACK_URL}/rounds`, (route) =>
    route.fulfill({
      json: [
        {
          id: roundId,
          name: 'Rodada 1',
          status: 'closed',
          durationMinutes: 30,
          openedAt: '2026-09-02T17:30:00Z',
          closesAt: null,
          closedAt: '2026-09-02T18:00:00Z',
          createdAt: '2026-09-02T17:00:00Z',
          updatedAt: '2026-09-02T18:00:00Z',
          problemCount: problemIds.length,
        },
      ],
    }),
  )
  await page.route(`${BACK_URL}/rounds/*/ranking`, (route) =>
    route.fulfill({ json: roundRanking(verdict.current) }),
  )
  await page.route(`${BACK_URL}/ranking`, (route) => route.fulfill({ json: eventRanking }))
  const titles = ['Soma dos pares', 'Maior valor']
  await page.route(
    (url) => url.origin === BACK_URL && url.pathname.startsWith('/problems/'),
    (route) => {
      const id = new URL(route.request().url()).pathname.split('/').at(-1)
      route.fulfill({ json: { title: titles[problemIds.indexOf(id ?? '')] ?? 'Problema' } })
    },
  )
}

// The screen lands on Geral when the only round is closed (#111), so every
// scenario starts by moving to Rodada, where the notice lives.
async function openRoundTab(page: Page) {
  await page.goto('/leaderboard')
  await page.getByTestId('leaderboard-tab-round').click()
  await expect(page.getByTestId('leaderboard-last-closed-label')).toContainText('Rodada 1')
  await expect(page.getByTestId('leaderboard-legend')).toContainText('Maior valor')
  await page.waitForTimeout(200) // let the tab pill's CSS transition settle
}

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: evidence(name), fullPage: true })
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
}

test.describe('leaderboard denominators notice (#318)', () => {
  test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

  test('the organizer sees whether the round is comparable; the participant sees nothing new', async ({
    page,
    request,
  }) => {
    const verdict: { current: Verdict } = { current: 'inconsistent' }
    await mockRanking(page, verdict)
    const organizerToken = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
    await page.addInitScript((token) => localStorage.setItem('kumite-token', token), organizerToken)
    await page.setViewportSize({ width: 1280, height: 800 })

    const inconsistent = page.getByTestId('leaderboard-denominators-inconsistent')
    const unknown = page.getByTestId('leaderboard-denominators-unknown')

    // 01 — inconsistent: the warning sits above the table, title and why.
    await openRoundTab(page)
    await expect(inconsistent).toBeVisible()
    await expect(inconsistent).toContainText('Pontuações desta rodada não são comparáveis')
    await expect(inconsistent).toContainText('Os totais dos times não podem ser comparados')
    await expect(unknown).toHaveCount(0)
    const noticeBox = await inconsistent.boundingBox()
    const tableBox = await page.getByTestId('leaderboard-table').boundingBox()
    expect(noticeBox!.y).toBeLessThan(tableBox!.y)
    await capture(page, '01-organizador-inconsistent')

    // The Geral tab stays as it was (#383 owns the event-wide verdict).
    await page.getByTestId('leaderboard-tab-event').click()
    await expect(page.getByTestId(`leaderboard-column-round-${roundId}`)).toBeVisible()
    await expect(inconsistent).toHaveCount(0)

    // 02 — unknown: only the discreet note.
    verdict.current = 'unknown'
    await openRoundTab(page)
    await expect(unknown).toBeVisible()
    await expect(unknown).toContainText('Não é possível confirmar')
    await expect(inconsistent).toHaveCount(0)
    await capture(page, '02-organizador-unknown')

    // 03 — consistent: the screen as it was before #318, no noise.
    verdict.current = 'consistent'
    await openRoundTab(page)
    await expect(inconsistent).toHaveCount(0)
    await expect(unknown).toHaveCount(0)
    await capture(page, '03-organizador-consistent-sem-ruido')

    // 05 — inconsistent at phone width, with no sideways scroll and the title
    // wrapping instead of being clipped (the shadcn AlertTitle clamps to one
    // line by default).
    verdict.current = 'inconsistent'
    await page.setViewportSize({ width: 390, height: 844 })
    await openRoundTab(page)
    await expect(inconsistent).toBeVisible()
    await noOverflow(page)
    const title = inconsistent.locator('[data-slot="alert-title"]')
    const clipped = await title.evaluate((node) => node.scrollHeight > node.clientHeight)
    expect(clipped).toBe(false)
    await capture(page, '05-organizador-inconsistent-celular')

    // 06 — inconsistent in the dark theme.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.evaluate(() => localStorage.setItem('kumite:theme', 'dark'))
    await openRoundTab(page)
    await expect(inconsistent).toBeVisible()
    await capture(page, '06-organizador-inconsistent-escuro')
  })

  test('a participant sees no notice, even on an inconsistent round', async ({ page, request }) => {
    await mockRanking(page, { current: 'inconsistent' })
    const token = await participantToken(request)
    await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)
    await page.setViewportSize({ width: 1280, height: 800 })

    await openRoundTab(page)
    await expect(page.getByTestId('leaderboard-table')).toBeVisible()
    await expect(page.getByTestId('leaderboard-denominators-inconsistent')).toHaveCount(0)
    await expect(page.getByTestId('leaderboard-denominators-unknown')).toHaveCount(0)
    await capture(page, '04-participante-inconsistent-sem-aviso')
  })
})
