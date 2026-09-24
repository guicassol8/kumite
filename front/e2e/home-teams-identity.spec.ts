import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import type { InferResponseType } from 'hono'
import type { api } from '../src/lib/api'

type TeamsResponse = InferResponseType<typeof api.teams.$get, 200>

import {
  BACK_URL,
  closeRound,
  createRound,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
  withRoundLock,
} from './support/rounds'

const evidence = (name: string) => `e2e/evidence/222/${name}.png`
const PASSWORD = 'identity-222-password'
const stamp = randomUUID()
const ownId = randomUUID()
const oldRoundId = randomUUID()
const recentRoundId = randomUUID()
const ownerEmail = `identity-222-${stamp}@edu.pucrs.br`
const longName = 'TimeComNomeLongoSemEspacosQuePrecisaCaber'
const longEmail = 'integrante.com.endereco.muito.longo.para.testar.quebra@merida.edu.mx'
type Member = TeamsResponse['teams'][number]['members'][number]
const members: [Member, Member] = [
  { university: 'pucrs', name: 'Ana Souza', email: ownerEmail },
  { university: 'merida', name: 'Luis Pech', email: longEmail },
]
const ownTeam: TeamsResponse['teams'][number] = {
  id: ownId,
  name: 'Byte Fighters',
  members,
  slotsAvailable: 2,
  frozen: false,
  joinBlockedReason: 'already_in_team',
}
const teamsFixture: TeamsResponse = {
  maxTeamSize: 4,
  mixingLocked: false,
  myTeamId: ownId,
  teams: [
    ownTeam,
    {
      id: 'full',
      name: 'Los Recursivos',
      members: [...members, ...members],
      slotsAvailable: 0,
      frozen: false,
      joinBlockedReason: 'team_full',
    },
    {
      id: 'open',
      name: longName,
      members: [members[0]],
      slotsAvailable: 3,
      frozen: false,
      joinBlockedReason: 'already_in_team',
    },
  ],
}
const closedRounds = [
  {
    id: oldRoundId,
    name: 'Aquecimento',
    status: 'closed',
    closedAt: '2026-09-01T18:00:00Z',
    problemCount: 1,
  },
  {
    id: recentRoundId,
    name: 'Rodada 1',
    status: 'closed',
    closedAt: '2026-09-02T18:00:00Z',
    problemCount: 1,
  },
]

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${BACK_URL}/auth/login`, { data: { email, password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  return token as string
}

async function participant(request: APIRequestContext, page: Page) {
  const email = `identity-${randomUUID()}@edu.pucrs.br`
  const response = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'Ana Souza', email, password: PASSWORD, code: 'PUCRS2026' },
  })
  expect(response.status()).toBe(201)
  const token = await login(request, email, PASSWORD)
  await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)
  return email
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

async function tokenColor(page: Page, element: Locator, property: string, token: string) {
  const value = await page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    token,
  )
  const hex = value.replace('#', '')
  const expected = `rgb(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)})`
  await expect(element).toHaveCSS(property, expected)
}

async function ready(page: Page) {
  await expect(page.getByTestId('home-team-card')).toContainText('Byte Fighters')
  await expect(page.getByTestId('home-team-last-result')).toContainText('#2')
  await expect(page.getByTestId('home-team-last-result')).toContainText('Rodada 1')
}

// Real authentication and round/SSE lifecycle; controlled roster/history make
// the visual states independent of previously accumulated test data.
test.describe('home and teams identity (#222)', () => {
  test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

  test('home live card, last result and mobile CTA in all three languages', async ({
    page,
    request,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problem = await request.post(`${BACK_URL}/organizer/problems`, {
      headers: auth,
      data: { difficulty: 'easy' },
    })
    const { id: problemId } = await problem.json()
    await request.patch(`${BACK_URL}/organizer/problems/${problemId}`, {
      headers: auth,
      data: {
        translations: [
          { locale: 'pt', title: 'Soma', statementMd: 'Some dois números.' },
          { locale: 'es', title: 'Suma', statementMd: 'Suma dos números.' },
          { locale: 'en', title: 'Sum', statementMd: 'Sum two numbers.' },
        ],
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [2, 2], expected: 4, hidden: true },
        ],
      },
    })
    const published = await request.post(`${BACK_URL}/organizer/problems/${problemId}/publish`, {
      headers: auth,
    })
    expect(published.ok()).toBeTruthy()
    const roundId = await createRound(auth, {
      name: 'Rodada 2',
      durationMinutes: 30,
      problemIds: [problemId],
    })
    let open = true
    let homeTeams = teamsFixture
    let roundName = 'Rodada 2'
    await page.route(`${BACK_URL}/teams`, (route) => route.fulfill({ json: homeTeams }))
    await page.route(`${BACK_URL}/rounds`, (route) =>
      route.fulfill({
        json: [
          ...closedRounds,
          ...(open
            ? [
                {
                  id: roundId,
                  name: roundName,
                  status: 'open',
                  closesAt: new Date(Date.now() + 30 * 60_000).toISOString(),
                  problemCount: 1,
                },
              ]
            : []),
        ],
      }),
    )
    await page.route(`${BACK_URL}/rounds/*/ranking`, (route) =>
      route.fulfill({
        json: {
          roundId: recentRoundId,
          roundName: 'Rodada 1',
          problemIds: [],
          teams: [
            {
              teamId: ownId,
              teamName: 'Byte Fighters',
              rank: 2,
              totalScore: 300,
              totalAttempts: 3,
              tiebreakTimeMs: 0,
              problems: [],
            },
          ],
        },
      }),
    )
    await participant(request, page)
    await roundSlot.open(auth, roundId)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await ready(page)
    const card = page.getByTestId('home-round-card')
    await expect(page.getByTestId('home-round-cta')).toBeVisible()
    await expect(page.getByRole('main').getByTestId('api-status')).toHaveCount(0)
    await expect(page.getByTestId('api-status-ok')).toBeVisible()
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => localStorage.setItem('kumite:theme', value), theme)
      await page.reload()
      await ready(page)
      await expect(page.getByTestId('home-round-live')).toBeVisible()
      await tokenColor(page, card, 'border-top-color', '--brand')
      await tokenColor(page, page.getByTestId('home-round-live'), 'color', '--brand-text')
      await tokenColor(page, card.getByTestId('round-countdown'), 'color', '--brand-text')
      await tokenColor(page, page.getByTestId('home-round-cta'), 'background-color', '--brand')
    }
    await page.evaluate(() => localStorage.setItem('kumite:theme', 'light'))
    await page.reload()
    await ready(page)
    await capture(page, '01-home-aberta-desktop')
    await page.setViewportSize({ width: 390, height: 844 })
    homeTeams = {
      ...teamsFixture,
      teams: teamsFixture.teams.map((team) =>
        team.id === ownId ? { ...team, name: longName } : team,
      ),
    }
    roundName = 'RodadaComNomeExtensoSemEspacosParaTestarQuebraNoCardEVisibilidadeDoBotaoNoCelular'
    await page.reload()
    await expect(card).toContainText(roundName)
    for (const language of ['pt', 'es', 'en']) {
      await page.getByTestId(`language-option-${language}`).click()
      await noOverflow(page)
      // No scrolling action before this assertion: the whole CTA must fit.
      const bounds = await page.getByTestId('home-round-cta').boundingBox()
      expect(bounds).not.toBeNull()
      if (!bounds) throw new Error('Missing home round CTA')
      expect(bounds.y).toBeGreaterThanOrEqual(0)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }
    await page.getByTestId('language-option-pt').click()
    homeTeams = teamsFixture
    roundName = 'Rodada 2'
    await page.reload()
    await ready(page)
    await capture(page, '02-home-aberta-celular')
    await capture(page, '04-home-time-ultima-rodada')
    await withRoundLock(async () => {
      open = false
      await closeRound(auth, roundId)
      await expect(card).toContainText('Aguardando a próxima rodada.')
      await expect(page.getByTestId('home-round-cta')).toHaveCount(0)
      await noOverflow(page)
      await capture(page, '03-home-aguardando')
    })
  })

  test('teams reflow, configured rules, states and shared badges', async ({ page, request }) => {
    const signedInEmail = await participant(request, page)
    let data: TeamsResponse = {
      ...teamsFixture,
      teams: [
        { ...ownTeam, members: [{ ...members[0], email: signedInEmail }, members[1]] },
        ...teamsFixture.teams.slice(1),
      ],
    }
    await page.route(`${BACK_URL}/teams`, (route) => route.fulfill({ json: data }))
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/teams')
    const panel = page.getByTestId('my-team-panel')
    await expect(panel).toContainText('Ana Souza')
    await expect(panel).toContainText(signedInEmail)
    await expect(panel).toContainText(longEmail)
    await expect(panel).toContainText('(você)')
    const badge = page.getByTestId('teams-your-team-badge')
    await expect(badge).toBeVisible()
    await tokenColor(page, badge, 'background-color', '--brand')
    await expect(page.getByTestId('teams-join-full')).toBeDisabled()
    await expect(page.getByTestId('teams-join-full')).toHaveText('Cheio')
    await expect(page.getByTestId('my-team-leave')).toBeEnabled()
    await expect(panel).not.toContainText('🇧🇷')
    await expect(panel).not.toContainText('🇲🇽')
    await expect(page.getByRole('columnheader').first()).toBeVisible()
    await capture(page, '05-times-desktop')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('columnheader').first()).toBeHidden()
    for (const language of ['pt', 'es', 'en']) {
      await page.getByTestId(`language-option-${language}`).click()
      await noOverflow(page)
      await expect(page.getByTestId(`teams-row-${ownId}`)).toHaveCSS('display', 'flex')
    }
    await page.getByTestId('language-option-pt').click()
    await capture(page, '06-times-celular')
    await page.setViewportSize({ width: 768, height: 844 })
    await expect(page.getByRole('columnheader').first()).toBeVisible()
    await noOverflow(page)
    data = {
      ...data,
      teams: [
        {
          ...ownTeam,
          members: data.teams.flatMap((team) => (team.id === ownId ? team.members : [])),
          frozen: true,
        },
        ...data.teams.slice(1),
      ],
    }
    await page.reload()
    await expect(page.getByTestId('my-team-frozen-notice')).toBeVisible()
    await expect(page.getByTestId('my-team-leave')).toBeDisabled()
    await capture(page, '08-time-congelado')
    await page.evaluate(() => localStorage.setItem('kumite:theme', 'dark'))
    await page.reload()
    await tokenColor(page, badge, 'background-color', '--brand')
    await tokenColor(page, page.getByTestId('my-team-leave'), 'border-top-color', '--destructive')
    await capture(page, '09-times-escuro')
    // Available actions and mixing restriction come from the response, not university heuristics.
    data = {
      ...data,
      myTeamId: null,
      mixingLocked: true,
      maxTeamSize: 5,
      teams: [
        { ...ownTeam, joinBlockedReason: 'mixed_lock_violation' },
        {
          ...ownTeam,
          id: 'open',
          name: longName,
          members: [members[0]],
          slotsAvailable: 3,
          joinBlockedReason: null,
        },
      ],
    }
    await page.evaluate(() => localStorage.setItem('kumite:theme', 'light'))
    await page.reload()
    await expect(page.getByTestId('teams-rules')).toContainText('5')
    await expect(page.getByTestId('teams-rules')).toContainText('travada')
    await expect(page.getByTestId(`teams-join-${ownId}`)).toBeDisabled()
    await expect(page.getByTestId('teams-join-open')).toBeEnabled()
    await page.getByTestId('teams-create-open').click()
    await page.getByTestId('teams-create-name-input').fill('Novo time')
    await capture(page, '07-criar-time')
    await page.getByTestId('teams-create-cancel').click()
    // Shared component on the scoreboard and organizer user panel.
    await page.route(`${BACK_URL}/rounds`, (route) => route.fulfill({ json: closedRounds }))
    await page.route(`${BACK_URL}/ranking`, (route) =>
      route.fulfill({
        json: {
          teams: [
            {
              teamId: ownId,
              teamName: 'Byte Fighters',
              rank: 1,
              totalScore: 300,
              totalAttempts: 1,
              tiebreakTimeMs: 0,
              rounds: [],
            },
          ],
        },
      }),
    )
    await page.route(`${BACK_URL}/rounds/*/ranking`, (route) =>
      route.fulfill({
        json: { roundId: recentRoundId, roundName: 'Rodada 1', problemIds: [], teams: [] },
      }),
    )
    await page.route(`${BACK_URL}/sse`, (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ type: 'state.sync', serverTime: new Date().toISOString(), round: null, submissionsPaused: false })}\n\n`,
      }),
    )
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/leaderboard')
    await page.getByTestId('leaderboard-tab-event').click()
    const scoreRow = page.getByTestId(`leaderboard-row-${ownId}`)
    await expect(scoreRow.getByTestId('university-badge-merida')).toBeVisible()
    await expect(scoreRow).not.toContainText('🇲🇽')
    await capture(page, '10-selos-placar')
    const organizerToken = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
    await page.addInitScript((token) => localStorage.setItem('kumite-token', token), organizerToken)
    await page.goto('/organizer/users')
    const users = page.getByTestId('organizer-users-table')
    await expect(users.getByTestId('university-badge-pucrs').first()).toBeVisible()
    await expect(users).not.toContainText('🇧🇷')
    await capture(page, '11-selos-organizador')
  })
})
