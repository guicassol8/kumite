import { expect, type Page, test } from '@playwright/test'

import { isViolation, sampleContrast, settle } from './support/contrast'
import {
  BACK_URL,
  EDITOR_FIXTURE_TIMEOUT_MS,
  hasOrganizerCredentials,
  seedEditorFixture,
  seedParticipant,
  seedParticipantToken,
} from './support/editor-fixture'
import { organizerAuthHeader } from './support/rounds'

// #234 — closing the visual-identity epic (#214): with `prefers-color-scheme`
// back on, a visitor on a dark OS lands in dark mode with no choice of their
// own, so every main route has to hold AA in dark. This is that smoke: each
// route, opened on a dark OS with nothing saved, swept by the meter of
// `support/contrast.ts` (proved by `contrast-meter.spec.ts`), at desktop and
// phone widths. Doubles as the PR's visual evidence.
//
// The Blockly canvas needs no exclusion: its block text, the flyout and #205's
// recenter control are SVG painted with `fill`, which the meter skips (the
// #218 palette is `check_tokens.py`'s job). The toolbox is NOT out, though:
// its category labels are HTML that inherited `.dark`'s paper foreground over
// Blockly's grey toolbox — 1.21:1, the one finding of this smoke, fixed in
// `index.css` until #218's editor theme takes over. Hover/open-menu states are
// out: this is the page at rest.
const evidence = (name: string) => `e2e/evidence/234/${name}.png`

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

// The identity's surfaces, as `docs/design/tokens/tokens.css` declares them.
const PAPER = 'rgb(252, 250, 247)' // #fcfaf7
const INK_SURFACE = 'rgb(18, 15, 13)' // #120f0d

type RouteCase = {
  slug: string
  path: () => string
  /** Which account the page is signed in as. */
  as: 'participant' | 'problem' | 'organizer'
  needsOrganizer: boolean
  ready: (page: Page) => Promise<void>
}

let participantToken = ''
let problemId = ''
let problemToken = ''
let organizerToken = ''

const ROUTES: RouteCase[] = [
  {
    slug: 'home',
    path: () => '/',
    as: 'participant',
    needsOrganizer: false,
    ready: async (page) => {
      await expect(page.getByTestId('home-heading')).toBeVisible()
      await expect(page.getByTestId('home-team-card')).toBeVisible()
    },
  },
  {
    slug: 'teams',
    path: () => '/teams',
    as: 'participant',
    needsOrganizer: false,
    ready: async (page) => {
      await expect(page.getByTestId('teams-heading')).toBeVisible()
      await expect(page.getByTestId('my-team-panel')).toBeVisible()
      await expect(page.getByTestId('teams-loading')).toHaveCount(0)
    },
  },
  {
    slug: 'leaderboard',
    path: () => '/leaderboard',
    as: 'participant',
    needsOrganizer: false,
    ready: async (page) => {
      await expect(page.getByTestId('leaderboard-tabs')).toBeVisible()
      await expect(page.getByTestId('leaderboard-loading')).toHaveCount(0)
    },
  },
  {
    slug: 'problema',
    path: () => `/problem/${problemId}`,
    as: 'problem',
    needsOrganizer: true,
    ready: async (page) => {
      await expect(page.locator('svg.blocklySvg')).toBeVisible()
    },
  },
  {
    slug: 'organizer',
    path: () => '/organizer',
    as: 'organizer',
    needsOrganizer: true,
    ready: async (page) => {
      await expect(page.getByTestId('overview-heading')).toBeVisible()
      await expect(page.getByTestId('overview-loading')).toHaveCount(0)
    },
  },
]

function tokenFor(route: RouteCase): string {
  if (route.as === 'problem') return problemToken
  if (route.as === 'organizer') return organizerToken
  return participantToken
}

async function openRoute(page: Page, route: RouteCase): Promise<void> {
  await seedParticipantToken(page, tokenFor(route))
  await page.goto(route.path())
  await route.ready(page)
}

function backgroundOfBody(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

test.beforeAll(async () => {
  test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)

  // A participant with a team: the home's team card and the teams page's
  // "my team" panel only render for one, and they carry the brand-soft and
  // muted pairs the sweep is here for.
  const participant = await seedParticipant('Dark Contrast')
  participantToken = participant.token
  const created = await fetch(`${BACK_URL}/teams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${participantToken}` },
    body: JSON.stringify({ name: `Escuro ${Date.now().toString().slice(-6)}` }),
  })
  if (!created.ok) throw new Error(`could not create the team (HTTP ${created.status})`)

  if (hasOrganizerCredentials) {
    ;({ problemId, participantToken: problemToken } = await seedEditorFixture('Dark Contrast'))
    organizerToken = (await organizerAuthHeader()).authorization?.replace(/^Bearer /, '') ?? ''
  }
})

test.describe('the main routes on a dark OS, nothing saved (#234)', () => {
  test.use({ colorScheme: 'dark' })

  const viewports = [
    { label: '', size: DESKTOP },
    { label: '-celular', size: MOBILE },
  ]

  ROUTES.forEach((route, index) => {
    for (const viewport of viewports) {
      test(`${route.slug}${viewport.label}: dark, and no text/background pair below AA`, async ({
        page,
      }) => {
        test.skip(
          route.needsOrganizer && !hasOrganizerCredentials,
          'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD',
        )
        await page.setViewportSize(viewport.size)
        await openRoute(page, route)

        await expect(page.locator('html')).toHaveClass(/dark/)
        await settle(page)

        const pairs = await sampleContrast(page)
        // An empty violation list from a sweep that saw nothing would prove
        // nothing: every one of these routes renders dozens of text nodes.
        expect(pairs.length).toBeGreaterThan(10)
        const violations = pairs.filter(isViolation)
        // The whole list on failure, so one run says everything to fix.
        expect(violations, JSON.stringify(violations, null, 2)).toEqual([])

        // The tightest pair, kept in the report as the margin this route has.
        const tightest = [...pairs].sort((a, b) => a.ratio / a.required - b.ratio / b.required)[0]
        if (tightest) {
          test.info().annotations.push({
            type: 'tightest pair',
            description: `${pairs.length} pairs; "${tightest.text}" (${tightest.testid}) ${tightest.ratio.toFixed(2)}:1, needs ${tightest.required}:1`,
          })
        }

        const nn = String(index + 10)
        await page.screenshot({
          path: evidence(`${nn}-${route.slug}-escuro${viewport.label}`),
          fullPage: true,
        })
      })
    }
  })
})

test.describe('a saved light choice beats a dark OS on every route (#234)', () => {
  test.use({ colorScheme: 'dark' })

  for (const route of ROUTES) {
    test(`${route.slug}: stays paper`, async ({ page }) => {
      test.skip(
        route.needsOrganizer && !hasOrganizerCredentials,
        'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD',
      )
      await page.addInitScript(() => localStorage.setItem('kumite:theme', 'light'))
      await openRoute(page, route)

      await expect(page.locator('html')).not.toHaveClass(/dark/)
      await expect.poll(() => backgroundOfBody(page)).toBe(PAPER)
    })
  }
})

test.describe('a saved dark choice beats a light OS on every route (#234)', () => {
  test.use({ colorScheme: 'light' })

  for (const route of ROUTES) {
    test(`${route.slug}: stays ink`, async ({ page }) => {
      test.skip(
        route.needsOrganizer && !hasOrganizerCredentials,
        'needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD',
      )
      await page.addInitScript(() => localStorage.setItem('kumite:theme', 'dark'))
      await openRoute(page, route)

      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect.poll(() => backgroundOfBody(page)).toBe(INK_SURFACE)
    })
  }
})
