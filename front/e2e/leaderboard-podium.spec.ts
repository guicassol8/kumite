import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import type { InferResponseType } from 'hono'
import type { api } from '../src/lib/api'

import { findContrastViolations, sampleContrast, settle } from './support/contrast'
import {
  BACK_URL,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// Visual walkthrough for #284: the closing ceremony on the projector.
//
// The ranking and the organizer's team listing are fulfilled by `page.route`
// while authentication stays real (the #318 recipe): the event ranking is
// global state every other spec moves, and the podium has to be shown with a
// known cast — twelve teams, two of them with zero points, a 40-character
// name on the top step and a mixed PUCRS + Mérida team. Step 09 drops the
// stubs and only checks that the real data renders.
const evidence = (name: string) => `e2e/evidence/284/${name}.png`

type EventRankingResponse = InferResponseType<typeof api.ranking.$get, 200>
type OrganizerTeamsResponse = InferResponseType<typeof api.organizer.teams.$get, 200>
type EventTeam = EventRankingResponse['teams'][number]
type OrganizerTeam = OrganizerTeamsResponse['teams'][number]
type University = OrganizerTeam['members'][number]['university']

const LONG_NAME = 'Los Recursivos Incansables de Mérida Sur'

const CAST: { name: string; score: number; members: [string | null, University][] }[] = [
  {
    name: LONG_NAME,
    score: 1840,
    members: [
      ['Luis Pech Canul', 'merida'],
      ['María José Chan', 'merida'],
      ['Ana Beatriz Souza', 'merida'],
    ],
  },
  {
    name: 'Byte Fighters',
    score: 1625,
    members: [
      ['Rafael Moreira', 'pucrs'],
      ['Sofía Ku Tun', 'merida'],
      // An account from before #122: never on screen, not even blank.
      [null, 'pucrs'],
    ],
  },
  {
    name: 'Loop Infinito',
    score: 1410,
    members: [
      ['Carla Mendes', 'pucrs'],
      ['Diego Ramírez', 'merida'],
      ['Eduarda Lima', 'pucrs'],
    ],
  },
  { name: 'Os Recursivos', score: 1200, members: [['Fábio Rocha', 'pucrs']] },
  { name: 'Null Pointers', score: 980, members: [['Gael Uc', 'merida']] },
  { name: 'Stack Overflowers', score: 910, members: [['Helena Dias', 'pucrs']] },
  { name: 'Dojo Mérida', score: 760, members: [['Iván Canché', 'merida']] },
  { name: 'Bits & Bytes', score: 540, members: [['Joana Prado', 'pucrs']] },
  { name: 'Compila Aí', score: 300, members: [['Karina May', 'merida']] },
  { name: 'Hello World', score: 120, members: [['Lucas Teixeira', 'pucrs']] },
  { name: 'Time Zerado', score: 0, members: [['Marta Pool', 'merida']] },
  { name: 'Outro Zerado', score: 0, members: [['Nina Alves', 'pucrs']] },
]

function fixture(cast: typeof CAST): {
  ranking: EventRankingResponse
  teams: OrganizerTeamsResponse
} {
  const withIds = cast.map((team) => ({ ...team, id: randomUUID() }))
  return {
    ranking: {
      rounds: [],
      teams: withIds.map(
        (team, index): EventTeam => ({
          teamId: team.id,
          teamName: team.name,
          rank: index + 1,
          totalScore: team.score,
          totalAttempts: 3,
          tiebreakTimeMs: 60_000 * (index + 1),
          rounds: [],
        }),
      ),
    },
    teams: {
      maxTeamSize: 3,
      teams: withIds.map(
        (team): OrganizerTeam => ({
          id: team.id,
          name: team.name,
          frozen: false,
          slotsAvailable: 3 - team.members.length,
          members: team.members.map(([name, university]) => ({
            userId: randomUUID(),
            email: `${randomUUID()}@edu.pucrs.br`,
            name,
            university,
            role: 'participant',
          })),
        }),
      ),
    },
  }
}

const full = fixture(CAST)
const twoScorers = fixture([...CAST.slice(0, 2), ...CAST.slice(10)])
const nobodyScored = fixture(CAST.slice(10))

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${BACK_URL}/auth/login`, { data: { email, password } })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  return token as string
}

// Routes are registered once per page; `current` picks what they answer, so
// a reload is all it takes to switch fixtures.
async function stubPodiumData(page: Page, current: { data: ReturnType<typeof fixture> }) {
  await page.route(`${BACK_URL}/ranking`, (route) => route.fulfill({ json: current.data.ranking }))
  await page.route(`${BACK_URL}/organizer/teams`, (route) =>
    route.fulfill({ json: current.data.teams }),
  )
}

async function asOrganizer(page: Page, request: APIRequestContext) {
  const token = await login(request, ORGANIZER_EMAIL, ORGANIZER_PASSWORD)
  await page.addInitScript((value) => {
    localStorage.setItem('kumite-token', value)
    // The user's own theme, so step 08 can prove it comes back.
    localStorage.setItem('kumite:theme', 'light')
  }, token)
}

// The entry ends with the list and the invite: once the invite is fully
// opaque, every place is in its final position.
async function waitForEntry(page: Page) {
  await expect(page.getByTestId('podium-invite')).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.fonts.ready)
}

async function fitsTheScreen(page: Page) {
  const size = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }))
  expect(size.scrollHeight, 'no vertical scroll on the projector').toBeLessThanOrEqual(size.height)
  expect(size.scrollWidth, 'no horizontal scroll on the projector').toBeLessThanOrEqual(size.width)
}

async function fontSize(page: Page, testId: string): Promise<number> {
  return page
    .getByTestId(testId)
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))
}

test.describe('leaderboard podium (#284)', () => {
  test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

  test('the organizer runs the closing ceremony on the projector', async ({ page, request }) => {
    // Ten steps and eight loads, each waiting out the ~2.4 s entry, plus the
    // confetti's ~4.8 s lifetime: 28–30 s on an idle machine, which is the
    // whole default budget — it failed on it once in review (#284).
    test.setTimeout(90_000)
    const current = { data: full }
    await stubPodiumData(page, current)
    await asOrganizer(page, request)
    await page.setViewportSize({ width: 1920, height: 1080 })

    // 01 — from the leaderboard, the organizer's button opens the pódio:
    // no header, no footer, forced dark.
    await page.goto('/leaderboard')
    await page.getByTestId('leaderboard-podium-link').click()
    await expect(page).toHaveURL(/\/leaderboard\/podium$/)
    await expect(page.getByTestId('podium-board')).toBeVisible()
    await expect(page.getByTestId('app-header')).toHaveCount(0)
    await expect(page.getByTestId('app-footer')).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await waitForEntry(page)
    await expect(page.getByTestId('podium-team-name-1')).toHaveText(LONG_NAME)
    await expect(page.getByTestId('podium-members-1')).toContainText('María José Chan')
    await expect(
      page.getByTestId('podium-place-2').getByTestId('university-badge-pucrs'),
    ).toBeVisible()
    await expect(
      page.getByTestId('podium-place-2').getByTestId('university-badge-merida'),
    ).toBeVisible()
    await expect(page.getByTestId('podium-members-2').locator('li')).toHaveCount(2)
    await expect(page.getByTestId('podium-rest').locator('li')).toHaveCount(7)
    await expect(page.getByTestId('podium-board')).not.toContainText('Time Zerado')
    await expect(page.getByTestId('podium-board')).not.toContainText('@')
    await expect(page.getByTestId('podium-invite')).toHaveText(
      'Obrigado por participar — até a próxima edição!',
    )
    await page.screenshot({ path: evidence('01-podio-1920x1080') })

    // 08 — Esc goes back to the board, focus on the button that opened the
    // pódio, the user's own (light) theme back and the chrome back. Taken
    // here, while the button's real fullscreen is still on: headless
    // Chromium does enter it, and nothing can resize a fullscreen window.
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByTestId('leaderboard-podium-link')).toBeFocused()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await expect(page.getByTestId('app-header')).toBeVisible()
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
    await page.screenshot({ path: evidence('08-volta-ao-placar') })

    // 02 — it fits the projector, at 1920×1080 and at WXGA 1280×800, with
    // the telão's distance typography. A deep link, so no fullscreen: the
    // viewport is exactly the size under test.
    await page.goto('/leaderboard/podium')
    await waitForEntry(page)
    await fitsTheScreen(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await fitsTheScreen(page)
    expect(await fontSize(page, 'podium-team-name-1')).toBeGreaterThanOrEqual(48)
    expect(await fontSize(page, 'podium-team-name-2')).toBeGreaterThanOrEqual(48)
    expect(await fontSize(page, 'podium-members-1')).toBeGreaterThanOrEqual(28)
    expect(await fontSize(page, 'podium-rest-row-4')).toBeGreaterThanOrEqual(28)
    expect(
      await page
        .getByTestId('podium-place-1')
        .getByTestId('university-badge-merida')
        .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(20)
    // 2–1–3 on screen: the winner in the middle, and the highest.
    const box = async (id: string) => {
      const found = await page.getByTestId(id).boundingBox()
      if (!found) throw new Error(`${id} is not laid out`)
      return found
    }
    const first = await box('podium-place-1')
    const second = await box('podium-place-2')
    const third = await box('podium-place-3')
    expect(second.x).toBeLessThan(first.x)
    expect(first.x).toBeLessThan(third.x)
    expect(first.y).toBeLessThan(second.y)
    expect(first.y).toBeLessThan(third.y)
    await page.screenshot({ path: evidence('02-podio-1280x800') })
    // Sized by the longest catalog, not the Portuguese one (identity.md § 5,
    // Expansão de texto): the invite is longest in English.
    for (const [language, invite] of [
      ['es', '¡Gracias por participar — hasta la próxima edición!'],
      ['en', 'Thanks for taking part — see you at the next edition!'],
    ] as const) {
      await page.evaluate((value) => localStorage.setItem('kumite-lang', value), language)
      await page.reload()
      await waitForEntry(page)
      await expect(page.getByTestId('podium-invite')).toHaveText(invite)
      await fitsTheScreen(page)
    }
    await page.screenshot({ path: evidence('02b-podio-1280x800-en') })
    await page.evaluate(() => localStorage.setItem('kumite-lang', 'pt'))
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    await waitForEntry(page)
    await fitsTheScreen(page)

    // 04 — no AA violation on the podium (before the confetti covers it).
    await settle(page)
    const pairs = await sampleContrast(page)
    expect(pairs.length).toBeGreaterThan(20)
    expect(await findContrastViolations(page)).toEqual([])

    // 03 — confetti, caught mid-fall.
    await page.getByTestId('podium-confetti-button').click()
    await expect(page.getByTestId('podium-confetti')).toBeVisible()
    await expect(page.getByTestId('podium-confetti-piece')).toHaveCount(80)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: evidence('03-confete') })
    await fitsTheScreen(page)
    await expect(page.getByTestId('podium-confetti')).toHaveCount(0, { timeout: 10_000 })

    // 05 — only two teams scored: only 1st and 2nd, no list, no error.
    current.data = twoScorers
    await page.reload()
    await waitForEntry(page)
    await expect(page.getByTestId('podium-place-1')).toBeVisible()
    await expect(page.getByTestId('podium-place-2')).toBeVisible()
    await expect(page.getByTestId('podium-place-3')).toHaveCount(0)
    await expect(page.getByTestId('podium-rest')).toHaveCount(0)
    await expect(page.getByTestId('podium-error')).toHaveCount(0)
    await page.screenshot({ path: evidence('05-dois-times') })

    // 06 — nobody scored.
    current.data = nobodyScored
    await page.reload()
    await expect(page.getByTestId('podium-empty')).toBeVisible()
    await expect(page.getByTestId('podium-places')).toHaveCount(0)
    await page.screenshot({ path: evidence('06-vazio') })

    // 07 — reduced motion: the whole podium is there on the first frame.
    current.data = full
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(page.getByTestId('podium-place-1')).toBeVisible()
    for (const id of ['podium-place-1', 'podium-place-2', 'podium-place-3', 'podium-invite']) {
      expect(
        await page.getByTestId(id).evaluate((node) => getComputedStyle(node).opacity),
        `${id} starts fully visible`,
      ).toBe('1')
    }
    await page.getByTestId('podium-confetti-button').click()
    await expect(page.getByTestId('podium-confetti')).toHaveAttribute('data-reduced-motion', 'true')
    await page.screenshot({ path: evidence('07-movimento-reduzido') })
  })

  test('the real ranking renders with no stub', async ({ page, request }) => {
    await asOrganizer(page, request)
    await page.setViewportSize({ width: 1920, height: 1080 })

    // 09 — whatever the event holds right now, the screen settles on the
    // podium or on its empty state, never on the error.
    await page.goto('/leaderboard/podium')
    await expect(page.getByTestId('podium-board')).toBeVisible()
    await expect(page.getByTestId('podium-loading')).toHaveCount(0)
    await expect(page.getByTestId('podium-error')).toHaveCount(0)
    await expect(
      page.getByTestId('podium-places').or(page.getByTestId('podium-empty')),
    ).toBeVisible()
    await page.screenshot({ path: evidence('09-dados-reais') })
  })
})

test('a participant who opens /leaderboard/podium is sent home like on any organizer route', async ({
  page,
  request,
}) => {
  // 10 — no organizer credentials needed: a fresh participant.
  const email = `podium-284-${randomUUID()}@edu.pucrs.br`
  const password = 'podium-284-password'
  const signup = await request.post(`${BACK_URL}/auth/signup`, {
    data: { name: 'Pódio Participante', email, password, code: 'PUCRS2026' },
  })
  expect(signup.status()).toBe(201)
  const token = await login(request, email, password)
  await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)

  await page.goto('/leaderboard/podium')

  await expect(page).toHaveURL(/\/\?notice=forbidden-organizer$/)
  await expect(page.getByTestId('home-notice-banner')).toBeVisible()
  await expect(page.getByTestId('podium-board')).toHaveCount(0)
  await page.screenshot({ path: evidence('10-participante-redirecionado') })
})
