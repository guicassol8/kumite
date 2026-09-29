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
// "reconnecting" banner into every capture. So `stubSse` answers the page's
// `/sse` fetch with a stream that stays open: by default it says "no round
// open" (the screen is live, and quiet). Only the transport is stubbed — the
// app's own sse-client still reads the body and parses every frame through
// the `SseEventSchema` mirror, which is what the live-round test relies on.
const evidence = (name: string, issue = 318) => `e2e/evidence/${issue}/${name}.png`

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
  // The event-wide verdict (#383) says the summed round is comparable, so the
  // Geral tab stays quiet in every #318 scenario below.
  rounds: [{ roundId, roundName: 'Rodada 1', denominators: 'consistent' }],
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

// Runs before the app on every navigation: wraps `fetch` so `/sse` gets
// `frames` (by default one `state.sync` with no open round) and then a body
// that never ends (it errors only when the client aborts, as a real socket
// would).
type SseFrame = Record<string, unknown>
const quietFrames = (): SseFrame[] => [
  {
    type: 'state.sync',
    serverTime: new Date().toISOString(),
    round: null,
    submissionsPaused: false,
  },
]

async function stubSse(page: Page, frames: SseFrame[]) {
  await page.addInitScript((frames) => {
    const realFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (new URL(url, window.location.href).pathname !== '/sse') return realFetch(input, init)
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const frame of frames) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`))
          }
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason))
        },
      })
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      )
    }
  }, frames)
}

// Routes are registered once per page; `verdict.current` picks what the
// ranking mock answers, so a reload is all it takes to switch scenarios.
async function mockRanking(
  page: Page,
  verdict: { current: Verdict },
  sseFrames: SseFrame[] = quietFrames(),
  event: { current: EventRankingResponse } = { current: eventRanking },
) {
  await stubSse(page, sseFrames)
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
  await page.route(`${BACK_URL}/ranking`, (route) => route.fulfill({ json: event.current }))
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

async function capture(page: Page, name: string, issue = 318) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: evidence(name, issue), fullPage: true })
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

    // The round's own notice never leaks into the Geral tab, which carries
    // its own event-wide verdict (#383) — consistent in this mock.
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

  // The bug behind #318's first step: the front's hand-written SSE mirror
  // dropped `denominators`, so the verdict vanished exactly while a round was
  // live. Here the stream announces an open round and pushes its
  // `ranking.updated` as `inconsistent`, while REST answers `consistent` for
  // the same round — so the warning can only have come through the app's
  // sse-client and the mirror's parse.
  test('the organizer is warned while the round is live over the stream', async ({
    page,
    request,
  }) => {
    const now = Date.now()
    const liveFrames: SseFrame[] = [
      {
        type: 'state.sync',
        serverTime: new Date(now).toISOString(),
        round: { id: roundId, closesAt: new Date(now + 20 * 60_000).toISOString() },
        submissionsPaused: false,
      },
      {
        type: 'ranking.updated',
        serverTime: new Date(now).toISOString(),
        round: roundRanking('inconsistent'),
        event: eventRanking,
      },
    ]
    await mockRanking(page, { current: 'consistent' }, liveFrames)
    const organizerToken = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
    await page.addInitScript((token) => localStorage.setItem('kumite-token', token), organizerToken)
    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto('/leaderboard')
    await expect(page.getByTestId('leaderboard-live-chip')).toBeVisible()
    await expect(page.getByTestId('leaderboard-tab-round')).toHaveAttribute('data-state', 'active')
    await expect(page.getByTestId('leaderboard-table')).toBeVisible()
    await expect(page.getByTestId('leaderboard-last-closed-label')).toHaveCount(0)
    const inconsistent = page.getByTestId('leaderboard-denominators-inconsistent')
    await expect(inconsistent).toBeVisible()
    await expect(inconsistent).toContainText('Pontuações desta rodada não são comparáveis')
    await expect(page.getByTestId('leaderboard-legend')).toContainText('Maior valor')
    await page.waitForTimeout(200) // let the tab pill's CSS transition settle
    await capture(page, '07-organizador-inconsistent-ao-vivo')
  })
})

// Visual walkthrough for #383: the Geral tab sums every announced round, so
// the organizer is told when one of them makes the event total not
// comparable. Same harness as #318 above (real auth, REST by `page.route`,
// `/sse` stubbed) — `inconsistent` is just as impossible to produce through
// the UI — with two summed rounds whose verdicts each scenario picks.
const secondRoundId = randomUUID()
type EventVerdicts = [Verdict, Verdict]

function eventRankingWith([first, second]: EventVerdicts): EventRankingResponse {
  return {
    rounds: [
      { roundId, roundName: 'Rodada 1', denominators: first },
      { roundId: secondRoundId, roundName: 'Rodada 2', denominators: second },
    ],
    teams: [
      {
        teamId: teamA,
        teamName: 'Byte Fighters',
        rank: 1,
        totalScore: 320,
        totalAttempts: 5,
        tiebreakTimeMs: 1_210_000,
        rounds: [
          { roundId, roundName: 'Rodada 1', score: 200, attempts: 3, tiebreakTimeMs: 610_000 },
          {
            roundId: secondRoundId,
            roundName: 'Rodada 2',
            score: 120,
            attempts: 2,
            tiebreakTimeMs: 600_000,
          },
        ],
      },
      {
        teamId: teamB,
        teamName: 'Los Recursivos',
        rank: 2,
        totalScore: 300,
        totalAttempts: 4,
        tiebreakTimeMs: 1_140_000,
        rounds: [
          { roundId, roundName: 'Rodada 1', score: 150, attempts: 2, tiebreakTimeMs: 540_000 },
          {
            roundId: secondRoundId,
            roundName: 'Rodada 2',
            score: 150,
            attempts: 2,
            tiebreakTimeMs: 600_000,
          },
        ],
      },
    ],
  }
}

// With only a closed round in the rounds list the screen lands on Geral (#111).
async function openEventTab(page: Page) {
  await page.goto('/leaderboard')
  await expect(page.getByTestId('leaderboard-tab-event')).toHaveAttribute('data-state', 'active')
  await expect(page.getByTestId('leaderboard-table')).toBeVisible()
  // Attached, not visible: a phone-width table hides the per-round columns.
  await expect(page.getByTestId(`leaderboard-column-round-${secondRoundId}`)).toBeAttached()
  await page.waitForTimeout(200) // let the tab pill's CSS transition settle
}

test.describe('leaderboard event denominators notice (#383)', () => {
  test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

  const inconsistentId = 'leaderboard-event-denominators-inconsistent'
  const unknownId = 'leaderboard-event-denominators-unknown'

  test('the organizer sees whether the event total is comparable; the telão never does', async ({
    page,
    request,
  }) => {
    const event = { current: eventRankingWith(['consistent', 'inconsistent']) }
    await mockRanking(page, { current: 'consistent' }, quietFrames(), event)
    const organizerToken = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
    await page.addInitScript((token) => localStorage.setItem('kumite-token', token), organizerToken)
    await page.setViewportSize({ width: 1280, height: 800 })

    const inconsistent = page.getByTestId(inconsistentId)
    const unknown = page.getByTestId(unknownId)

    // 01 — inconsistent: the warning sits above the Geral table and names only
    // the round that mixed scales.
    await openEventTab(page)
    await expect(inconsistent).toBeVisible()
    await expect(inconsistent).toContainText('O total do evento não é comparável entre os times')
    await expect(inconsistent).toContainText(
      'Esta soma inclui uma rodada em que um mesmo problema foi pontuado em escalas diferentes: Rodada 2.',
    )
    await expect(unknown).toHaveCount(0)
    // The round's own #318 notice stays on Rodada.
    await expect(page.getByTestId('leaderboard-denominators-inconsistent')).toHaveCount(0)
    const noticeBox = await inconsistent.boundingBox()
    const tableBox = await page.getByTestId('leaderboard-table').boundingBox()
    expect(noticeBox!.y).toBeLessThan(tableBox!.y)
    await capture(page, '01-organizador-inconsistent', 383)

    // 02 — unknown only: the discreet note, naming no round.
    event.current = eventRankingWith(['unknown', 'consistent'])
    await openEventTab(page)
    await expect(unknown).toBeVisible()
    await expect(unknown).toContainText('Não é possível confirmar que o total do evento')
    await expect(inconsistent).toHaveCount(0)
    await capture(page, '02-organizador-unknown', 383)

    // 03 — every summed round consistent: the Geral tab as it was, no noise.
    event.current = eventRankingWith(['consistent', 'consistent'])
    await openEventTab(page)
    await expect(inconsistent).toHaveCount(0)
    await expect(unknown).toHaveCount(0)
    await capture(page, '03-organizador-consistent-sem-ruido', 383)

    // 05 — both rounds inconsistent at phone width: plural copy, no sideways
    // scroll, and the title wraps instead of being clipped to one line.
    event.current = eventRankingWith(['inconsistent', 'inconsistent'])
    await page.setViewportSize({ width: 390, height: 844 })
    await openEventTab(page)
    await expect(inconsistent).toBeVisible()
    await expect(inconsistent).toContainText('escalas diferentes: Rodada 1 e Rodada 2.')
    await noOverflow(page)
    const title = inconsistent.locator('[data-slot="alert-title"]')
    const clipped = await title.evaluate((node) => node.scrollHeight > node.clientHeight)
    expect(clipped).toBe(false)
    await capture(page, '05-telefone-390', 383)

    // 06 — the dark theme.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.evaluate(() => localStorage.setItem('kumite:theme', 'dark'))
    await openEventTab(page)
    await expect(inconsistent).toBeVisible()
    await capture(page, '06-tema-escuro', 383)

    // 07 — the telão, projected for everyone, shows the Geral ranking with no
    // notice even though a summed round is inconsistent.
    await page.getByTestId('leaderboard-presentation-toggle').click()
    await expect(page.getByTestId('leaderboard-presentation-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByTestId('telao-general-badge')).toBeVisible()
    await expect(inconsistent).toHaveCount(0)
    await expect(unknown).toHaveCount(0)
    await capture(page, '07-telao-sem-aviso', 383)
  })

  test('a participant sees no notice, even when a summed round is inconsistent', async ({
    page,
    request,
  }) => {
    const event = { current: eventRankingWith(['consistent', 'inconsistent']) }
    await mockRanking(page, { current: 'consistent' }, quietFrames(), event)
    const token = await participantToken(request)
    await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)
    await page.setViewportSize({ width: 1280, height: 800 })

    await openEventTab(page)
    await expect(page.getByTestId('leaderboard-table')).toBeVisible()
    await expect(page.getByTestId(inconsistentId)).toHaveCount(0)
    await expect(page.getByTestId(unknownId)).toHaveCount(0)
    await capture(page, '04-participante-sem-aviso', 383)
  })

  // The stream announces an open round and pushes a `ranking.updated` whose
  // event ranking says Rodada 2 is inconsistent, while REST says every round is
  // consistent — so the warning can only have come through the app's
  // sse-client and the mirror's parse, which would strip an unknown `rounds`.
  test('the organizer is warned from a live ranking.updated over the stream', async ({
    page,
    request,
  }) => {
    const now = Date.now()
    const liveFrames: SseFrame[] = [
      {
        type: 'state.sync',
        serverTime: new Date(now).toISOString(),
        round: { id: roundId, closesAt: new Date(now + 20 * 60_000).toISOString() },
        submissionsPaused: false,
      },
      {
        type: 'ranking.updated',
        serverTime: new Date(now).toISOString(),
        round: roundRanking('consistent'),
        event: eventRankingWith(['consistent', 'inconsistent']),
      },
    ]
    const event = { current: eventRankingWith(['consistent', 'consistent']) }
    await mockRanking(page, { current: 'consistent' }, liveFrames, event)
    const organizerToken = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
    await page.addInitScript((token) => localStorage.setItem('kumite-token', token), organizerToken)
    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto('/leaderboard')
    await expect(page.getByTestId('leaderboard-live-chip')).toBeVisible()
    await expect(page.getByTestId('leaderboard-tab-round')).toHaveAttribute('data-state', 'active')
    await page.getByTestId('leaderboard-tab-event').click()
    await expect(page.getByTestId(`leaderboard-column-round-${secondRoundId}`)).toBeVisible()
    const inconsistent = page.getByTestId(inconsistentId)
    await expect(inconsistent).toBeVisible()
    await expect(inconsistent).toContainText('escalas diferentes: Rodada 2.')
    await page.waitForTimeout(200) // let the tab pill's CSS transition settle
    await capture(page, '08-ao-vivo-sse', 383)
  })

  // The copy and the round list's conjunction follow the viewer's language:
  // both notices in es and en (pt is every capture above).
  for (const { lang, heading, list, note, shots } of [
    {
      lang: 'es',
      heading: 'El total del evento no es comparable entre los equipos',
      list: 'escalas diferentes: Rodada 1 y Rodada 2.',
      note: 'No es posible confirmar que el total del evento',
      shots: ['09-espanhol-inconsistent', '10-espanhol-unknown'],
    },
    {
      lang: 'en',
      heading: 'The event total is not comparable between teams',
      list: 'different scales: Rodada 1 and Rodada 2.',
      note: 'Unable to confirm that the event total',
      shots: ['11-ingles-inconsistent', '12-ingles-unknown'],
    },
  ] as const) {
    test(`the organizer reads both notices in ${lang}`, async ({ page, request }) => {
      const event = { current: eventRankingWith(['inconsistent', 'inconsistent']) }
      await mockRanking(page, { current: 'consistent' }, quietFrames(), event)
      const organizerToken = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
      await page.addInitScript(
        ([token, language]) => {
          localStorage.setItem('kumite-token', token)
          localStorage.setItem('kumite-lang', language)
        },
        [organizerToken, lang] as const,
      )
      await page.setViewportSize({ width: 1280, height: 800 })

      const inconsistent = page.getByTestId(inconsistentId)
      const unknown = page.getByTestId(unknownId)

      await openEventTab(page)
      await expect(inconsistent).toContainText(heading)
      await expect(inconsistent).toContainText(list)
      await capture(page, shots[0], 383)

      event.current = eventRankingWith(['unknown', 'consistent'])
      await openEventTab(page)
      await expect(unknown).toContainText(note)
      await expect(inconsistent).toHaveCount(0)
      await capture(page, shots[1], 383)
    })
  }
})
