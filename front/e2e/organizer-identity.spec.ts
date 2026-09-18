import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

import {
  BACK_URL,
  expect,
  hasOrganizerCredentials,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// #223 — the organizer panel in the identity: shell, overview and the listing
// tables. jsdom does no layout, so every criterion about reflow, tab wrapping
// and horizontal scroll can only be settled here, in a real browser.
//
// Authentication is real (the seeded organizer). The panel's READS are served
// from `page.route` fixtures: the states this spec has to show — three problem
// states crossed with three difficulties, a round open and a round closed, a
// user with an unbreakable e-mail — are expensive to produce for real, and
// producing them would mean opening a round, which contends on the event-wide
// single-open-round slot for no gain here (nothing below asserts round
// behaviour, only how a round is painted).
const evidence = (name: string) => `e2e/evidence/223/${name}.png`

const PHONE = { width: 390, height: 844 }
// Exactly the breakpoint: `size.breakpoint-cards`. The table comes back at
// this width, with the least room it will ever have — the tightest case in the
// panel, and the one the acceptance criterion is really about.
const BREAKPOINT = { width: 768, height: 1024 }
const DESKTOP = { width: 1280, height: 900 }

const LANGUAGES = ['pt', 'es', 'en'] as const
const PANEL_ROUTES = [
  '/organizer',
  '/organizer/problems',
  '/organizer/rounds',
  '/organizer/teams',
  '/organizer/users',
  '/organizer/event-config',
] as const

const TAB_TESTIDS = [
  'organizer-nav-overview',
  'organizer-nav-problems',
  'organizer-nav-rounds',
  'organizer-nav-event-config',
  'organizer-nav-teams',
  'organizer-nav-users',
] as const

const openRoundId = randomUUID()
const closedRoundId = randomUUID()

function problem(
  id: string,
  title: string,
  difficulty: 'easy' | 'medium' | 'hard',
  status: 'draft' | 'published' | 'archived',
) {
  return {
    id,
    points: 10,
    difficulty,
    status,
    testCaseCount: 3,
    translations: [
      { locale: 'pt', title },
      { locale: 'es', title },
      { locale: 'en', title },
    ],
  }
}

// The three states crossed with the three difficulties, so one screenshot
// carries every badge the identity defines for this table.
const problems = [
  problem('p-easy', 'Soma de dois números', 'easy', 'published'),
  problem('p-medium', 'Ordenação de uma lista', 'medium', 'draft'),
  problem('p-hard', 'Caminho mais curto no labirinto', 'hard', 'archived'),
]

const rounds = [
  {
    id: 'r-draft',
    name: 'Rodada 3',
    status: 'draft',
    durationMinutes: 30,
    openedAt: null,
    closesAt: null,
    closedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    problemCount: 2,
  },
  {
    id: openRoundId,
    name: 'Rodada 2',
    status: 'open',
    durationMinutes: 45,
    openedAt: '2026-09-02T12:00:00.000Z',
    closesAt: new Date(Date.now() + 40 * 60_000).toISOString(),
    closedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    problemCount: 3,
  },
  {
    id: closedRoundId,
    name: 'Rodada 1',
    status: 'closed',
    durationMinutes: 30,
    openedAt: '2026-09-01T12:00:00.000Z',
    closesAt: '2026-09-01T12:30:00.000Z',
    closedAt: '2026-09-01T12:30:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T12:30:00.000Z',
    problemCount: 2,
  },
]

// No spaces to break at, and the Spanish header above it is "Correo
// electrónico" — together they are what decides whether seven columns fit at
// exactly 768px without pushing the page into horizontal scroll.
const longEmail = 'maria.fernanda.villanueva.del.carmen@posgrado.merida.edu.mx'

const users = {
  items: [
    {
      id: 'u-1',
      email: 'ada.lovelace@edu.pucrs.br',
      name: 'Ada Lovelace',
      role: 'participant',
      university: 'pucrs',
      active: true,
      team: { id: 't-1', name: 'Blockly Busters' },
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'u-2',
      email: longEmail,
      name: 'María Fernanda Villanueva',
      role: 'organizer',
      university: 'merida',
      active: false,
      team: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  total: 2,
}

const organizerTeams = {
  maxTeamSize: 4,
  teams: [
    {
      id: 't-1',
      name: 'Blockly Busters',
      frozen: false,
      slotsAvailable: 2,
      members: [
        {
          userId: 'u-1',
          email: 'ada.lovelace@edu.pucrs.br',
          name: 'Ada Lovelace',
          university: 'pucrs',
          role: 'participant',
        },
        {
          userId: 'u-2',
          email: longEmail,
          name: 'María Fernanda Villanueva',
          university: 'merida',
          role: 'participant',
        },
      ],
    },
    {
      id: 't-2',
      name: 'Los Recursivos',
      frozen: true,
      slotsAvailable: 0,
      members: [
        {
          userId: 'u-3',
          email: 'luis.pech@merida.edu.mx',
          name: 'Luis Pech',
          university: 'merida',
          role: 'participant',
        },
      ],
    },
  ],
}

const eventCodes = [
  {
    code: 'PUCRS2026',
    university: 'pucrs',
    allowedEmailSuffixes: ['edu.pucrs.br'],
    active: true,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    code: 'MERIDA2026',
    university: 'merida',
    allowedEmailSuffixes: ['merida.edu.mx', 'posgrado.merida.edu.mx'],
    active: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
]

function stats(round: 'open' | 'closed') {
  return {
    participants: { total: 137, pucrs: 82, merida: 55, inTeam: 104, withoutTeam: 33 },
    teams: { total: 21, openSlots: 12, maxTeamSize: 4 },
    submissions: { total: 486, inRound: 137 },
    round:
      round === 'open'
        ? { active: rounds[1], lastClosed: rounds[2] }
        : { active: null, lastClosed: rounds[2] },
  }
}

const ranking = {
  roundId: closedRoundId,
  roundName: 'Rodada 1',
  problemIds: [],
  teams: [
    {
      teamId: 't-1',
      teamName: 'Blockly Busters',
      rank: 1,
      totalScore: 300,
      totalAttempts: 4,
      tiebreakTimeMs: 1000,
      problems: [],
    },
    {
      teamId: 't-2',
      teamName: 'Los Recursivos',
      rank: 2,
      totalScore: 220,
      totalAttempts: 5,
      tiebreakTimeMs: 2000,
      problems: [],
    },
    {
      teamId: 't-3',
      teamName: 'Bit Benders',
      rank: 3,
      totalScore: 150,
      totalAttempts: 6,
      tiebreakTimeMs: 3000,
      problems: [],
    },
  ],
}

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: evidence(name), fullPage: true })
}

/** Identity § 5: horizontal scroll is never the answer to overflow. */
async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
}

/**
 * The same criterion, plus the panel's own half: `<main>` does not scroll
 * horizontally and no descendant of it crosses the viewport edge.
 *
 * This used to be a *replacement* for `noOverflow` at exactly 768px, because
 * the whole-document check could not pass there — and not because of anything
 * on this screen: at that width the header flipped to its desktop layout and
 * its right-hand cluster did not fit, pushing `document.scrollWidth` to 791
 * (pt) / 827 (es). #297 fixed the header, so both checks now run at 768 too
 * (see the callers), and this one has gone back to being what it always
 * should have been: the extra, panel-scoped detail.
 */
async function noPanelOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return null
    const width = window.innerWidth
    return {
      scrolls: main.scrollWidth > main.clientWidth,
      offenders: Array.from(main.querySelectorAll('*'))
        .filter((node) => node.getBoundingClientRect().right > width + 0.5)
        .map((node) => (node as HTMLElement).dataset.testid ?? node.tagName)
        .slice(0, 6),
    }
  })
  expect(report).not.toBeNull()
  expect(report?.offenders).toEqual([])
  expect(report?.scrolls).toBe(false)
}

/** Asserts a CSS property equals the literal value of a design token. */
async function tokenColor(page: Page, element: Locator, property: string, token: string) {
  const value = await page.evaluate(
    (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    token,
  )
  const hex = value.replace('#', '')
  const expected = `rgb(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)})`
  await expect(element).toHaveCSS(property, expected)
}

async function login(request: APIRequestContext) {
  const response = await request.post(`${BACK_URL}/auth/login`, {
    data: { email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD },
  })
  expect(response.ok()).toBeTruthy()
  const { token } = await response.json()
  return token as string
}

type PanelOptions = { round?: 'open' | 'closed'; theme?: 'light' | 'dark' }

async function installPanel(page: Page, request: APIRequestContext, options: PanelOptions = {}) {
  const token = await login(request)
  await page.addInitScript((value) => localStorage.setItem('kumite-token', value), token)
  if (options.theme === 'dark') {
    await page.addInitScript(() => localStorage.setItem('kumite:theme', 'dark'))
  }

  const roundState = options.round ?? 'open'
  await page.route(`${BACK_URL}/organizer/stats`, (route) =>
    route.fulfill({ json: stats(roundState) }),
  )
  await page.route(`${BACK_URL}/rounds/*/ranking`, (route) => route.fulfill({ json: ranking }))
  await page.route(`${BACK_URL}/organizer/problems`, (route) => route.fulfill({ json: problems }))
  await page.route(`${BACK_URL}/organizer/rounds`, (route) => route.fulfill({ json: rounds }))
  await page.route(`${BACK_URL}/organizer/teams`, (route) =>
    route.fulfill({ json: organizerTeams }),
  )
  await page.route(`${BACK_URL}/organizer/users*`, (route) => route.fulfill({ json: users }))
  await page.route(`${BACK_URL}/organizer/event-codes`, (route) =>
    route.fulfill({ json: eventCodes }),
  )
  await page.route(`${BACK_URL}/organizer/event-config`, (route) =>
    route.fulfill({ json: { mixingLocked: false, maxTeamSize: 4, updatedAt: null } }),
  )
}

async function switchLanguage(page: Page, language: (typeof LANGUAGES)[number]) {
  // Always click, PT included: the selector persists the choice, so an early
  // return for PT would leave the page in whatever language the previous loop
  // ended on — which is how the phone capture came out in English.
  await page.getByTestId(`language-option-${language}`).click()
  await expect(page.getByTestId(`language-option-${language}`)).toHaveAttribute(
    'aria-current',
    'true',
  )
}

test.describe('organizer panel identity (#223)', () => {
  test.skip(!hasOrganizerCredentials, 'Requires the local seeded organizer')

  test('shell: the tabs wrap onto two rows on a phone, underline intact', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(PHONE)
    await page.goto('/organizer')
    await expect(page.getByTestId('organizer-heading')).toBeVisible()

    for (const language of LANGUAGES) {
      await switchLanguage(page, language)

      // All six tabs, the same testids as the desktop — no component swap, no
      // sideways scroll (identity § 5, Abas).
      const tops: number[] = []
      for (const testId of TAB_TESTIDS) {
        const tab = page.getByTestId(testId)
        await expect(tab).toBeVisible()
        const box = await tab.boundingBox()
        expect(box).not.toBeNull()
        tops.push(Math.round(box?.y ?? 0))
      }
      // Exactly two rows: all visible, none clipped, none scrolled away.
      expect(new Set(tops).size).toBe(2)
      await noOverflow(page)

      // Spanish is the deciding language: its six labels are the longest sum
      // of the three catalogs.
      if (language === 'es') await capture(page, '03-abas-celular')
    }

    await switchLanguage(page, 'pt')
  })

  test('shell: the 2px underline marks the active tab and only it', async ({ page, request }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)

    for (const [route, activeTestId] of [
      ['/organizer', 'organizer-nav-overview'],
      ['/organizer/problems', 'organizer-nav-problems'],
      ['/organizer/users', 'organizer-nav-users'],
    ] as const) {
      await page.goto(route)
      const active = page.getByTestId(activeTestId)
      await expect(active).toBeVisible()
      await expect(active).toHaveCSS('border-bottom-width', '2px')
      await tokenColor(page, active, 'border-bottom-color', '--brand')

      for (const testId of TAB_TESTIDS) {
        if (testId === activeTestId) continue
        await expect(page.getByTestId(testId)).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
      }
    }
  })

  test('overview: the open round card is the branded one; the podium leads in brand', async ({
    page,
    request,
  }) => {
    await installPanel(page, request, { round: 'open' })
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer')

    const card = page.getByTestId('overview-round-card')
    await expect(card).toBeVisible()
    await tokenColor(page, card, 'border-top-color', '--brand')
    await tokenColor(page, page.getByTestId('overview-round-open-state'), 'color', '--brand-text')
    await tokenColor(page, card.getByTestId('round-countdown'), 'color', '--brand-text')
    // The stat role: 44px display numerals.
    await expect(page.getByTestId('overview-signups-total')).toHaveCSS('font-size', '44px')
    await noOverflow(page)
    await capture(page, '01-visao-geral-desktop')

    // With no round open the card drops the brand border and the podium
    // appears on a card of its own.
    await installPanel(page, request, { round: 'closed' })
    await page.setViewportSize(PHONE)
    await page.goto('/organizer')
    await expect(page.getByTestId('overview-podium-card')).toBeVisible()
    const winner = page.getByTestId('overview-round-podium-t-1').locator('span').first()
    await tokenColor(page, winner, 'color', '--brand-text')
    await expect(page.getByTestId('overview-shortcuts-users')).toBeVisible()
    await noOverflow(page)
    await capture(page, '02-visao-geral-celular')
  })

  test('problems: eyebrow headers, hairlines and the outlined difficulty badges', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/problems')

    const table = page.getByTestId('organizer-problems-table')
    await expect(table).toBeVisible()

    const header = table.locator('th').first()
    await expect(header).toHaveCSS('text-transform', 'uppercase')
    expect(await header.evaluate((node) => getComputedStyle(node).fontFamily)).toContain(
      'Barlow Condensed',
    )

    const row = page.getByTestId('organizer-problems-row-p-easy')
    // From 768px up the row is a table row again.
    await expect(row).toHaveCSS('display', 'table-row')
    await tokenColor(page, row, 'border-bottom-color', '--border')
    await expect(row).toHaveCSS('box-shadow', 'none')

    // Médio carries --warning-text: --warning itself is 2,0:1 and may never
    // be text.
    await tokenColor(
      page,
      page.getByTestId('organizer-problems-difficulty-p-medium'),
      'color',
      '--warning-text',
    )
    // Difícil is a crimson OUTLINE, never a filled plate.
    const hard = page.getByTestId('organizer-problems-difficulty-p-hard')
    await expect(hard).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await tokenColor(page, hard, 'border-bottom-color', '--destructive')
    await noOverflow(page)
    await capture(page, '04-problemas-desktop')

    // Below the breakpoint the same nodes become one card per row.
    await page.setViewportSize(PHONE)
    await expect(row).toHaveCSS('display', 'flex')
    await noOverflow(page)
    await capture(page, '05-problemas-celular')
  })

  test('rounds: the open round wears the dotted outline badge', async ({ page, request }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/rounds')

    const open = page.getByTestId(`organizer-rounds-status-${openRoundId}`)
    await expect(open).toBeVisible()
    await expect(open).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await tokenColor(
      page,
      page.getByTestId(`organizer-rounds-status-dot-${openRoundId}`),
      'background-color',
      '--brand',
    )
    // Closed and draft stay grey, with no dot.
    await expect(page.getByTestId(`organizer-rounds-status-dot-${closedRoundId}`)).toHaveCount(0)
    await noOverflow(page)
    await capture(page, '06-rodadas-desktop')
  })

  test('users: seven columns fit at exactly 768px, in all three languages', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(BREAKPOINT)
    await page.goto('/organizer/users')
    await expect(page.getByTestId('organizer-users-table')).toBeVisible()

    for (const language of LANGUAGES) {
      await switchLanguage(page, language)
      // The whole point of the issue: at the breakpoint it is a table with the
      // columns compressed, and the page still does not scroll sideways —
      // "Correo electrónico" and "Universidad" included. Whole document since
      // #297 fixed the header, which is what used to force the panel scope.
      await expect(page.getByTestId('organizer-users-row-u-1')).toHaveCSS('display', 'table-row')
      await noOverflow(page)
      await noPanelOverflow(page)
      if (language === 'es') await capture(page, '07-usuarios-desktop')
    }
    await switchLanguage(page, 'pt')

    await page.setViewportSize(PHONE)
    await expect(page.getByTestId('organizer-users-row-u-1')).toHaveCSS('display', 'flex')
    await noOverflow(page)
    await capture(page, '08-usuarios-celular')
  })

  test('teams: the remove-team action is a crimson outline, never a red plate', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/teams')

    const remove = page.getByTestId('team-moderation-remove-team-action-t-1')
    await expect(remove).toBeVisible()
    // This issue only consumes the variant #216 redefined.
    await expect(remove).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await tokenColor(page, remove, 'border-bottom-color', '--destructive')

    const members = page.getByTestId('team-moderation-members-t-1')
    await expect(members.locator('th').first()).toHaveCSS('text-transform', 'uppercase')
    await noOverflow(page)
    await capture(page, '09-times-desktop')

    // The member list inside a card was the panel's worst phone overflow.
    await page.setViewportSize(PHONE)
    await expect(page.getByTestId('team-moderation-member-row-u-1')).toHaveCSS('display', 'flex')
    await noOverflow(page)
  })

  test('event config: the codes table joins the identity, its dialog untouched', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/event-config')

    const table = page.getByTestId('event-config-codes-table')
    await expect(table).toBeVisible()
    await expect(table.locator('th').first()).toHaveCSS('text-transform', 'uppercase')
    await expect(page.getByTestId('event-config-codes-row-pucrs')).toHaveCSS('display', 'table-row')
    await noOverflow(page)
    await capture(page, '10-config-evento')
  })

  test('the whole panel holds in dark mode, and never scrolls sideways', async ({
    page,
    request,
  }) => {
    await installPanel(page, request, { theme: 'dark' })
    await page.setViewportSize(DESKTOP)
    await page.goto('/organizer/problems')
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Same criteria, dark tokens: --warning-text and --destructive both move.
    await tokenColor(
      page,
      page.getByTestId('organizer-problems-difficulty-p-medium'),
      'color',
      '--warning-text',
    )
    await tokenColor(
      page,
      page.getByTestId('organizer-problems-difficulty-p-hard'),
      'border-bottom-color',
      '--destructive',
    )
    await tokenColor(
      page,
      page.getByTestId('organizer-problems-row-p-easy'),
      'border-bottom-color',
      '--border',
    )
    await noOverflow(page)
    await capture(page, '11-painel-escuro')
  })

  test('no panel screen scrolls sideways, at either width, in any language', async ({
    page,
    request,
  }) => {
    await installPanel(page, request)

    for (const size of [PHONE, BREAKPOINT]) {
      await page.setViewportSize(size)
      for (const route of PANEL_ROUTES) {
        await page.goto(route)
        await expect(page.getByTestId('organizer-heading')).toBeVisible()
        for (const language of LANGUAGES) {
          await switchLanguage(page, language)
          // Both widths take the whole document since #297; 768 also keeps the
          // panel-scoped detail, which names the offending element.
          await noOverflow(page)
          if (size === BREAKPOINT) await noPanelOverflow(page)
        }
        await switchLanguage(page, 'pt')
      }
    }
  })
})
