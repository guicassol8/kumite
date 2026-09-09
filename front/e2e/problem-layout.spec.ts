import { somaDosPares } from '@kumite/blocks'
import type { Page } from '@playwright/test'

import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  seedEditorFixture,
  seedParticipantToken,
} from './support/editor-fixture'
import {
  BACK_URL,
  createRound,
  expect,
  hasOrganizerCredentials,
  organizerAuthHeader,
  test,
} from './support/rounds'

// #155: the editor panel used to let the action bar and the result cards
// overflow the route box, so they rendered under the footer and off screen —
// clicking Executar looked like it did nothing. Only a real browser can prove
// the fix: jsdom measures nothing, so `problem.$id.test.tsx` pins the skeleton
// and everything about *height* is asserted here.
const evidence = (name: string) => `e2e/evidence/155/${name}.png`

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox()
  if (!box) throw new Error(`expected "${testId}" to be laid out`)
  return box
}

/** Acceptance #10: the shell adds no scroll of its own when the route fits. */
async function expectNoPageScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return root.scrollHeight - root.clientHeight
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

/** The footer sits below <main>, never on top of it. */
async function expectFooterBelowMain(page: Page): Promise<void> {
  const mainBox = await page.locator('main').first().boundingBox()
  const footerBox = await page.getByTestId('app-footer').boundingBox()
  if (!mainBox || !footerBox) throw new Error('expected a full layout')
  expect(footerBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height - 1)
}

/** Seeds the saved workspace, which is what the screen restores on mount. */
async function seedWorkspace(page: Page, problemId: string, state: unknown): Promise<void> {
  await page.addInitScript(
    ([key, saved]) => {
      window.localStorage.setItem(key as string, saved as string)
    },
    [`kumite:workspace:${problemId}`, JSON.stringify(state)],
  )
}

const VIEWPORTS = [
  // `yieldsStatement`: on the stacked layout the statement card is the only
  // thing that can afford to give way, so it drops from max-h-64 to max-h-36
  // when the band appears. On md+ it owns its own column and never competes.
  {
    label: 'desktop',
    size: { width: 1280, height: 720 },
    closed: '01',
    results: '02',
    yieldsStatement: false,
  },
  {
    label: 'mobile',
    size: { width: 390, height: 844 },
    closed: '06',
    results: '07',
    yieldsStatement: true,
  },
] as const

test.describe('/problem/$id — barra ancorada, rodada encerrada (#155)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let problemId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    // A closed round: this describe never submits, so it must not hold the
    // single-open-round slot against the rest of the suite.
    ;({ problemId, participantToken } = await seedEditorFixture('Problem Layout'))
  })

  test.beforeEach(async ({ page }) => {
    await seedParticipantToken(page, participantToken)
    await seedWorkspace(page, problemId, somaDosPares)
  })

  for (const { label, size, closed, results, yieldsStatement } of VIEWPORTS) {
    test(`mantém Executar e Limpar na viewport e a faixa entre canvas e barra (${label})`, async ({
      page,
    }) => {
      await page.setViewportSize(size)
      await page.goto(`/problem/${problemId}`)
      await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()

      // Acceptance #3: the closed-round notice stays anchored above the canvas,
      // Executar and Limpar stay, Enviar is gone.
      await expect(page.getByTestId('problem-closed-notice')).toBeVisible()
      await expect(page.getByTestId('problem-submit-button')).toHaveCount(0)
      const notice = await boxOf(page, 'problem-closed-notice')
      const canvasBefore = await boxOf(page, 'blockly-workspace')
      expect(notice.y + notice.height).toBeLessThanOrEqual(canvasBefore.y + 1)

      // Acceptance #1: both buttons reachable without scrolling anything.
      await expect(page.getByTestId('problem-run-button')).toBeVisible()
      await expect(page.getByTestId('problem-clear-button')).toBeVisible()
      const barBefore = await boxOf(page, 'problem-actions-bar')
      const statementBefore = await boxOf(page, 'problem-statement-panel')
      expect(barBefore.y + barBefore.height).toBeLessThanOrEqual(size.height + 1)
      await expectNoPageScroll(page)
      await expectFooterBelowMain(page)
      await page.screenshot({ path: evidence(`${closed}-${label}-rodada-encerrada`) })

      // Acceptance #4 + #6: the results land in the band, the bar does not move
      // and the canvas gives up exactly the height the band took.
      await page.getByTestId('problem-run-button').click()
      await expect(page.getByTestId('problem-results-band')).toBeVisible()
      await expect(page.getByTestId('problem-results-summary')).toHaveText('3/3 casos')
      const band = await boxOf(page, 'problem-results-band')
      const barAfter = await boxOf(page, 'problem-actions-bar')
      const canvasAfter = await boxOf(page, 'blockly-workspace')

      expect(Math.abs(barAfter.y - barBefore.y)).toBeLessThanOrEqual(1)
      expect(barAfter.y + barAfter.height).toBeLessThanOrEqual(size.height + 1)
      // The band really is between the two, not overlapping either.
      expect(band.y).toBeGreaterThanOrEqual(canvasAfter.y + canvasAfter.height - 1)
      expect(band.y + band.height).toBeLessThanOrEqual(barAfter.y + 1)
      // The canvas shrank instead of pushing the bar off screen — and it is
      // still a usable editor, not the 4px strip the first cut of this fix left
      // on mobile.
      expect(canvasAfter.height).toBeLessThan(canvasBefore.height)
      expect(canvasAfter.height).toBeGreaterThan(150)

      // Where the height came from: the side column keeps its size, the
      // stacked statement gives some back.
      const statementAfter = await boxOf(page, 'problem-statement-panel')
      if (yieldsStatement) {
        expect(statementAfter.height).toBeLessThan(statementBefore.height)
      } else {
        expect(statementAfter.height).toBe(statementBefore.height)
      }

      // Blockly followed its container: without the ResizeObserver firing, the
      // svg would keep the pre-band height and clip the blocks.
      const svg = await page
        .getByTestId('blockly-workspace')
        .locator('svg.blocklySvg')
        .boundingBox()
      if (!svg) throw new Error('expected the Blockly svg to be laid out')
      expect(Math.abs(svg.height - canvasAfter.height)).toBeLessThanOrEqual(2)

      await expectNoPageScroll(page)
      await expectFooterBelowMain(page)
      await page.screenshot({ path: evidence(`${results}-${label}-resultados-na-faixa`) })
    })
  }

  // Acceptance #7 + #9: on the phone the band is capped well under its own
  // content, so it is the band that scrolls — never the page.
  test('rola dentro da faixa, nunca a página, quando o espaço aperta', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()

    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-band')).toBeVisible()
    await expect(page.getByTestId('problem-results-summary')).toHaveText('3/3 casos')

    const scroll = await page.getByTestId('problem-results-band').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    // If this ever stops overflowing, the assertion below proves nothing —
    // fail here instead of passing vacuously.
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight)
    expect(scroll.overflowY).toBe('auto')
    expect(scroll.clientHeight).toBeLessThanOrEqual(844)

    const bar = await boxOf(page, 'problem-actions-bar')
    expect(bar.y + bar.height).toBeLessThanOrEqual(845)
    await expectNoPageScroll(page)
    await page.screenshot({ path: evidence('08-mobile-estreito-faixa-rolavel') })
  })

  // The band is the only child of the panel that may shrink, so on a phone
  // shorter than a flagship it used to absorb the whole deficit and collapse to
  // 0px — clicking Executar looked like it did nothing all over again, which is
  // the very bug #155 exists to kill. Below 700px tall the statement, the
  // closed-round notice and the canvas each lend it a slice.
  test('mantém a faixa utilizável numa tela baixa (360x640)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()

    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-band')).toBeVisible()
    await expect(page.getByTestId('problem-results-summary')).toHaveText('3/3 casos')

    const band = await boxOf(page, 'problem-results-band')
    const canvas = await boxOf(page, 'blockly-workspace')
    const bar = await boxOf(page, 'problem-actions-bar')
    // Room for the "Resultados" header plus the top of the first case: the 0px
    // collapse and the 27px sliver that the first cut of this fix left both
    // fail here.
    expect(band.height).toBeGreaterThan(60)
    // ...while the canvas stays an editor rather than a strip.
    expect(canvas.height).toBeGreaterThan(120)
    // And nothing was bought by pushing the bar or the page out of frame.
    expect(bar.y + bar.height).toBeLessThanOrEqual(641)
    await expectNoPageScroll(page)
    await expectFooterBelowMain(page)
    await page.screenshot({ path: evidence('09-mobile-baixo-faixa-utilizavel') })
  })
})

test.describe('/problem/$id — barra ancorada, rodada aberta (#155)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  const PASSWORD = 'supersecret'
  const stamp = Date.now()

  /**
   * Setup that fails loudly: a silently-ignored 4xx here would surface later as
   * an unexplained "could not load the problem" on the screen under test.
   */
  async function api(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${BACK_URL}${path}`, init)
    if (!res.ok) {
      throw new Error(`setup ${init.method} ${path} failed: ${res.status} ${await res.text()}`)
    }
    return res
  }

  let problemId: string
  let roundId: string
  let participantToken: string

  test.beforeAll(async () => {
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    const auth = await organizerAuthHeader()

    const created = await api('/organizer/problems', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    ;({ id: problemId } = (await created.json()) as { id: string })
    await api(`/organizer/problems/${problemId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: 'Soma dos Pares', statementMd: 'Some os números pares.' },
          { locale: 'es', title: 'Suma de Pares', statementMd: 'Suma los números pares.' },
          { locale: 'en', title: 'Sum of Evens', statementMd: 'Sum the even numbers.' },
        ],
        testCases: [
          { input: [1, 2, 3, 4], expected: 6, hidden: false },
          { input: [5, 7, 9], expected: 0, hidden: false },
          { input: [2, 4, 6, 8], expected: 20, hidden: false },
          { input: [10, 11, 12], expected: 22, hidden: true },
        ],
      }),
    })
    await api(`/organizer/problems/${problemId}/publish`, { method: 'POST', headers: auth })
    // Created as a draft here and opened inside the test, under `roundSlot` —
    // that is what closes it again on a failure, a timeout or an exception,
    // instead of leaving it holding the single-open-round slot for 30min (#150).
    roundId = await createRound(auth, {
      name: `Problem Layout Aberta E2E ${stamp}`,
      durationMinutes: 30,
      problemIds: [problemId],
    })

    const email = `problem-layout-e2e-${stamp}@edu.pucrs.br`
    await api('/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, code: 'PUCRS2026' }),
    })
    const login = await api('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    ;({ token: participantToken } = (await login.json()) as { token: string })
    // Submitting is a team act: without one the route answers 404 not_in_team.
    await api('/teams', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${participantToken}`,
      },
      body: JSON.stringify({ name: `Problem Layout ${stamp}` }),
    })
  })

  test('mantém Enviar, o veredito e o banner de erro ancorados', async ({ page, roundSlot }) => {
    // Judging three cases in a real sandbox, plus the open retries.
    test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
    const auth = await organizerAuthHeader()
    await roundSlot.open(auth, roundId)

    await seedParticipantToken(page, participantToken)
    await seedWorkspace(page, problemId, somaDosPares)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/problem/${problemId}`)
    await expect(page.getByTestId('blockly-workspace').locator('svg.blocklySvg')).toBeVisible()

    // Acceptance #2: Enviar lives in the same anchored bar, inside the viewport.
    await expect(
      page.getByTestId('problem-actions-bar').getByTestId('problem-submit-button'),
    ).toBeVisible()
    const barBefore = await boxOf(page, 'problem-actions-bar')
    expect(barBefore.y + barBefore.height).toBeLessThanOrEqual(721)
    await expectNoPageScroll(page)
    await page.screenshot({ path: evidence('03-desktop-rodada-aberta-enviar') })

    // Acceptance #5: a real verdict renders inside the band, bar unmoved.
    await page.getByTestId('problem-submit-button').click()
    await expect(page.getByTestId('problem-verdict-panel')).toBeVisible()
    const verdictInBand = await page
      .getByTestId('problem-results-band')
      .evaluate((band) =>
        band.contains(band.querySelector('[data-testid="problem-verdict-panel"]')),
      )
    expect(verdictInBand).toBe(true)
    const barAfter = await boxOf(page, 'problem-actions-bar')
    expect(Math.abs(barAfter.y - barBefore.y)).toBeLessThanOrEqual(1)
    expect(barAfter.y + barAfter.height).toBeLessThanOrEqual(721)
    await expectNoPageScroll(page)
    await expectFooterBelowMain(page)
    await page.screenshot({ path: evidence('04-desktop-veredito-na-faixa') })

    // Acceptance #8: the cooldown banner stays at the top of the panel. This is
    // the one forged state in the suite — reproducing the real 5s cooldown
    // needs two judged submissions back to back, and that race is the flakiest
    // thing this spec could depend on.
    await page.route('**/submissions', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'submission_throttled', message: 'Wait 5s' }),
      })
    })
    await page.getByTestId('problem-submit-button').click()
    await expect(page.getByTestId('problem-cooldown-banner')).toBeVisible()
    const banner = await boxOf(page, 'problem-cooldown-banner')
    const canvas = await boxOf(page, 'blockly-workspace')
    expect(banner.y + banner.height).toBeLessThanOrEqual(canvas.y + 1)
    expect(banner.y + banner.height).toBeLessThanOrEqual(720)
    await expectNoPageScroll(page)
    await page.screenshot({ path: evidence('05-desktop-banner-erro-ancorado') })
  })
})
