import { somaDosPares } from '@kumite/blocks'
import type { Page } from '@playwright/test'

import { editorTestTimeout, expectBlocklyInjected } from './support/blockly'
import {
  seedParticipant,
  seedParticipantToken,
  workspaceStorageKey,
} from './support/editor-fixture'
import {
  BACK_URL,
  closeRound,
  createRound,
  expect,
  hasOrganizerCredentials,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual walkthrough for #219: `/problem/$id` in the new identity — the
// statement's difficulty/points/letter badges, the markdown statement, the
// examples in mono, the per-case results band, the verdict as an alert and
// Submeter as the one red button of the screen. run-examples.spec.ts (#5) and
// problem-layout.spec.ts (#155) are untouched; this only proves the restyle.
// Prereqs:
//   docker compose up -d && pnpm --filter @kumite/back db:migrate && db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD exported in the shell.
const evidence = (name: string) => `e2e/evidence/219/${name}.png`

/** `--brand` (#dd2824) as the browser reports it. */
const BRAND_FILL = 'rgb(221, 40, 36)'

/**
 * The semantic borders the verdict alert has to carry: `--success` (#008433)
 * when approved, `--destructive` (#c1133a) when not. Asserting the background
 * is not brand red proves only that it is not a filled plate — it says nothing
 * about the outline, which is the half of "crimson em contorno" that went
 * missing when `alertVariants` gave `destructive` no border of its own. Since
 * #308 the verdict has no local fix, so this also guards the primitive.
 */
const SUCCESS_BORDER = 'rgb(0, 132, 51)'
const CRIMSON_BORDER = 'rgb(193, 19, 58)'

/**
 * The canonical solution with its `resto = 0` test flipped to `resto ≠ 0`, so
 * it sums the ODD numbers and every case fails — which is what produces a
 * rejected verdict. Same trick run-examples.spec.ts (#5) uses.
 */
const somaDosImpares = JSON.parse(JSON.stringify(somaDosPares).replace('"OP":"EQ"', '"OP":"NEQ"'))

const stamp = Date.now()

test.describe('problem screen identity (#219)', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  let hardProblemId: string
  let mediumProblemId: string
  let roundId: string
  let participantToken: string
  let participantId: string

  /**
   * A published problem whose four cases mirror the editor fixture's, so the
   * canonical `somaDosPares` really passes and its odd-sum twin really fails.
   */
  async function publishProblem(
    difficulty: 'easy' | 'medium' | 'hard',
    points: number,
    title: string,
  ): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty }),
    })
    const { id } = (await created.json()) as { id?: string }
    if (!id) throw new Error(`could not create the problem (HTTP ${created.status})`)

    // The statement is markdown on purpose: #219 makes the participant read it
    // through the same MarkdownPreview the organizer's own preview uses, and a
    // plain-text statement would prove nothing about that.
    const statementMd = [
      'Some todos os números **pares** da lista.',
      '',
      '- A lista pode estar vazia.',
      '- O resultado de uma lista sem pares é `0`.',
    ].join('\n')

    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        points,
        translations: [
          { locale: 'pt', title, statementMd },
          { locale: 'es', title, statementMd },
          { locale: 'en', title, statementMd },
        ],
        testCases: [
          { input: [1, 2, 3, 4], expected: 6, hidden: false },
          { input: [5, 7, 9], expected: 0, hidden: false },
          { input: [2, 4, 6, 8], expected: 20, hidden: false },
          { input: [10, 11, 12], expected: 22, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  /** Seeds the saved workspace, which is what the screen restores on mount. */
  async function seedWorkspace(page: Page, problemId: string, state: unknown): Promise<void> {
    await page.addInitScript(
      ([key, saved]) => {
        window.localStorage.setItem(key as string, saved as string)
      },
      [workspaceStorageKey(participantId, problemId), JSON.stringify(state)],
    )
  }

  async function openEditor(page: Page, problemId: string): Promise<void> {
    await page.goto(`/problem/${problemId}`)
    await expectBlocklyInjected(page)
  }

  /** A genuine pointer drag on a #203 separator — the same gesture
   * problem-panels.spec.ts uses, and the only one the layout persists. */
  async function dragHandle(page: Page, testId: string, dy: number): Promise<void> {
    const box = await page.getByTestId(testId).boundingBox()
    if (!box) throw new Error(`expected "${testId}" to be laid out`)
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY + dy, { steps: 10 })
    await page.mouse.up()
  }

  /**
   * The judge throttles one submission per team per SUBMISSION_COOLDOWN_MS
   * (5s by default), and this walkthrough submits twice — the second one lands
   * inside that window and comes back as the cooldown banner instead of a
   * verdict. Retrying until the verdict shows keeps the spec independent of
   * the configured value rather than sleeping a hardcoded one.
   */
  async function submitUntilVerdict(page: Page): Promise<void> {
    const verdict = page.getByTestId('problem-verdict-panel')
    const cooldown = page.getByTestId('problem-cooldown-banner')
    await expect(async () => {
      await page.getByTestId('problem-submit-button').click()
      await expect(verdict.or(cooldown).first()).toBeVisible({ timeout: 20_000 })
      expect(await verdict.count()).toBe(1)
    }).toPass({ timeout: 90_000, intervals: [3_000] })
  }

  /**
   * The guard this walkthrough needs most: `toBeVisible()` passes on an
   * element the results band has scrolled out of sight, because a box clipped
   * by an overflow ancestor still has a size. A screenshot taken then shows
   * none of what the assertion claimed. `elementFromPoint` is what actually
   * answers "is this on screen": clipped away, the hit test lands on the band
   * instead of on the element.
   */
  async function expectOnScreen(page: Page, testId: string): Promise<void> {
    const onScreen = await page.getByTestId(testId).evaluate((node) => {
      const rect = node.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const x = rect.left + rect.width / 2
      const y = rect.top + Math.min(rect.height / 2, 8)
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false
      const hit = document.elementFromPoint(x, y)
      return hit !== null && (hit === node || node.contains(hit))
    })
    expect(onScreen, `expected "${testId}" to be on screen, not clipped by the band`).toBe(true)
  }

  test.beforeAll(async () => {
    test.setTimeout(90_000)
    const auth = await organizerAuthHeader()
    // Position 0 and position 1 in this order — the letters A and B the
    // statement card shows are read from the round, never from the problem.
    hardProblemId = await publishProblem('hard', 150, `Contar Negativos ${stamp}`)
    mediumProblemId = await publishProblem('medium', 100, `Soma dos Pares ${stamp}`)
    roundId = await createRound(auth, {
      name: `Rodada Identidade Problema ${stamp}`,
      durationMinutes: 30,
      problemIds: [hardProblemId, mediumProblemId],
    })
    const participant = await seedParticipant('Problem Identity')
    participantToken = participant.token
    participantId = participant.id
    // A submission belongs to a team, not to a user: without one, every
    // Submeter answers 404 `not_in_team` and the screen shows the race banner
    // instead of a verdict.
    const team = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${participantToken}`,
      },
      body: JSON.stringify({ name: `Time Identidade ${stamp}` }),
    })
    if (!team.ok) {
      throw new Error(`could not create the participant's team (HTTP ${team.status})`)
    }
  })

  test('badges, results, verdict and the one red button, on desktop and on a phone', async ({
    page,
    roundSlot,
  }) => {
    // Four editor mounts (openEditor below) on top of the judge runs.
    test.setTimeout(editorTestTimeout(4, 180_000))
    const auth = await organizerAuthHeader()
    await seedParticipantToken(page, participantToken)
    await seedWorkspace(page, mediumProblemId, somaDosPares)
    await seedWorkspace(page, hardProblemId, somaDosImpares)
    await roundSlot.open(auth, roundId)

    // 01 — desktop, round open. The statement opens with the badge row:
    // "Médio" on the amber-TEXT token, the points, and the letter B the
    // problem has in THIS round. Each read through its own testid: the card
    // keeps `sr-only` labels, so asserting the panel's text would happily
    // match a badge that is not on screen.
    await openEditor(page, mediumProblemId)
    const difficulty = page.getByTestId('problem-difficulty-badge')
    await expect(difficulty).toBeVisible()
    await expect(difficulty).toHaveText('Médio')
    await expect(difficulty).toHaveAttribute('data-variant', 'warning')
    const points = page.getByTestId('problem-points-badge')
    await expect(points).toBeVisible()
    await expect(points).toHaveText('100 pts')
    const letter = page.getByTestId('problem-position-badge')
    await expect(letter).toBeVisible()
    await expect(letter).toHaveText('Problema B')

    // The statement really is rendered markdown, not the raw `**pares**`.
    const statement = page.getByTestId('problem-statement-body')
    await expect(statement.locator('strong')).toHaveText('pares')
    await expect(statement).not.toContainText('**')
    // And the examples read as `entrada → esperada`, in mono.
    const firstExample = page.getByTestId('problem-example-0')
    await expect(firstExample).toBeVisible()
    await expect(firstExample).toContainText('[1,2,3,4]')
    await expect(firstExample).toContainText('6')
    await expect(firstExample).toHaveCSS('font-family', /mono/i)
    for (const testId of [
      'problem-difficulty-badge',
      'problem-points-badge',
      'problem-position-badge',
      'problem-example-0',
    ]) {
      await expectOnScreen(page, testId)
    }
    await page.screenshot({ path: evidence('01-desktop-enunciado'), fullPage: true })

    // 02 — Executar: one row per case, each with its icon, its input and
    // expected against obtained, plus the `3/3 casos` pill in the header.
    await page.getByTestId('problem-run-button').click()
    // The band opens at 25% of the editor column, which fits its header and
    // nothing else. #203 made it resizable precisely for this: drag it open so
    // the case rows are actually on screen, and prove they are.
    await expect(page.getByTestId('problem-results-summary')).toBeVisible()
    await dragHandle(page, 'problem-results-handle', -180)
    const summary = page.getByTestId('problem-results-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toHaveText('3/3 casos')
    await expect(summary).toHaveAttribute('data-state', 'passed')
    await expect(summary).toHaveAttribute('data-slot', 'badge')
    for (const index of [0, 1, 2]) {
      await expect(page.getByTestId(`problem-result-${index}`)).toHaveAttribute(
        'data-status',
        'passed',
      )
    }
    const firstRow = page.getByTestId('problem-result-0')
    await expect(firstRow).toContainText('[1,2,3,4]')
    await expect(firstRow).toContainText('esperado 6')
    await expect(firstRow).toContainText('obtido 6')
    // The state is in words too, not only in the icon's colour (identity § 3).
    await expect(firstRow.getByText('Passou')).toHaveCount(1)
    for (const index of [0, 1, 2]) await expectOnScreen(page, `problem-result-${index}`)
    await page.screenshot({ path: evidence('02-resultados-por-caso'), fullPage: true })

    // 03 — the bar itself: Submeter is the ONLY element filled in brand red,
    // Executar is an outline and Limpar blocos is crimson text.
    const filledInBrand = await page.evaluate((brand) => {
      const bar = document.querySelector('[data-testid="problem-actions-bar"]')
      if (!bar) return []
      return [...bar.querySelectorAll('button')]
        .filter((button) => getComputedStyle(button).backgroundColor === brand)
        .map((button) => button.getAttribute('data-testid'))
    }, BRAND_FILL)
    expect(filledInBrand).toEqual(['problem-submit-button'])
    const runBackground = await page
      .getByTestId('problem-run-button')
      .evaluate((node) => getComputedStyle(node).backgroundColor)
    expect(runBackground).not.toBe(BRAND_FILL)
    // Cropped to the bar: a full page here would be pixel-for-pixel 02, and
    // what this step proves is the three buttons side by side.
    await page
      .getByTestId('problem-actions-bar')
      .screenshot({ path: evidence('03-barra-de-acoes') })

    // 04 — Submeter with the canonical solution: a full score reads as an
    // approved verdict, in the green alert.
    await submitUntilVerdict(page)
    const verdict = page.getByTestId('problem-verdict-panel')
    await expect(verdict).toBeVisible()
    await expect(verdict).toHaveAttribute('data-state', 'passed')
    await expect(verdict).toHaveAttribute('role', 'alert')
    await expect(verdict.getByText('Aprovado')).toHaveCount(1)
    await expect(verdict).toHaveCSS('border-color', SUCCESS_BORDER)
    await expect(page.getByTestId('problem-verdict-summary')).toContainText('100')
    // The band scrolls: the verdict lands below the run results, so bring it
    // into view before the screenshot and prove it arrived.
    await verdict.scrollIntoViewIfNeeded()
    await expectOnScreen(page, 'problem-verdict-panel')
    await page.screenshot({ path: evidence('04-veredito-aprovado'), fullPage: true })

    // 05 — the other problem of the same round: letter A, "Difícil" as a
    // crimson OUTLINE, and a wrong solution whose verdict is the crimson
    // alert — outlined, never a filled red plate.
    await openEditor(page, hardProblemId)
    await expect(page.getByTestId('problem-position-badge')).toHaveText('Problema A')
    const hardBadge = page.getByTestId('problem-difficulty-badge')
    await expect(hardBadge).toHaveText('Difícil')
    await expect(hardBadge).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await page.getByTestId('problem-run-button').click()
    await expect(page.getByTestId('problem-results-summary')).toHaveText('0/3 casos')
    await submitUntilVerdict(page)
    const rejected = page.getByTestId('problem-verdict-panel')
    await expect(rejected).toBeVisible()
    await expect(rejected).toHaveAttribute('data-state', 'failed')
    await expect(rejected.getByText('Não aprovado')).toHaveCount(1)
    // Outline, not a plate: the alert's own background is the card's...
    const verdictFill = await rejected.evaluate((node) => getComputedStyle(node).backgroundColor)
    expect(verdictFill).not.toBe(BRAND_FILL)
    // ...and the outline is really crimson, not the neutral hairline. Without
    // this the panel read as crimson text on a grey border and every other
    // assertion here still passed.
    await expect(rejected).toHaveCSS('border-color', CRIMSON_BORDER)
    await rejected.scrollIntoViewIfNeeded()
    await expectOnScreen(page, 'problem-verdict-panel')
    await page.screenshot({ path: evidence('05-veredito-reprovado'), fullPage: true })

    // 06 — 390x844: the bar #160 anchored is still on screen and reachable,
    // and this screen's own content adds no horizontal scroll. Scoped to
    // <main>, as round-screen-identity.spec.ts is.
    await page.setViewportSize({ width: 390, height: 844 })
    await openEditor(page, mediumProblemId)
    const bar = page.getByTestId('problem-actions-bar')
    await expect(bar).toBeVisible()
    await expect(page.getByTestId('problem-submit-button')).toBeVisible()
    const [mainScrollWidth, innerWidth, barBottom] = await page.evaluate(() => [
      document.querySelector('main')?.scrollWidth ?? 0,
      window.innerWidth,
      document.querySelector('[data-testid="problem-actions-bar"]')?.getBoundingClientRect()
        .bottom ?? 0,
    ])
    expect(mainScrollWidth).toBeLessThanOrEqual(innerWidth)
    expect(barBottom).toBeLessThanOrEqual(844)
    await expectOnScreen(page, 'problem-actions-bar')
    await expectOnScreen(page, 'problem-submit-button')
    await page.screenshot({ path: evidence('06-celular-390'), fullPage: true })
    // #199: with the statement folded the canvas takes the height — and the
    // bar, Submeter included, stays exactly where #160 anchored it.
    const toggle = page.getByTestId('problem-statement-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expectOnScreen(page, 'problem-actions-bar')
    await expectOnScreen(page, 'problem-submit-button')
    expect(await bar.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
      844,
    )
    await page.screenshot({ path: 'e2e/evidence/199/08-celular-rodada-aberta-recolhido.png' })
    await page.setViewportSize({ width: 1280, height: 800 })

    // 07 — round closed: the read-only notice reads as an alert with its icon,
    // and Submeter is gone while Executar and Limpar stay.
    await closeRound(auth, roundId)
    await openEditor(page, mediumProblemId)
    const notice = page.getByTestId('problem-closed-notice')
    await expect(notice).toBeVisible({ timeout: 15_000 })
    await expect(notice).toHaveAttribute('role', 'alert')
    await expect(notice.locator(':scope > svg')).toHaveCount(1)
    await expect(page.getByTestId('problem-submit-button')).toHaveCount(0)
    await expect(page.getByTestId('problem-run-button')).toBeVisible()
    // Outside a round there is no position to read, so no letter (#219, Q1).
    await expect(page.getByTestId('problem-position-badge')).toHaveCount(0)
    await expectOnScreen(page, 'problem-closed-notice')
    await page.screenshot({ path: evidence('07-rodada-encerrada'), fullPage: true })
  })
})
