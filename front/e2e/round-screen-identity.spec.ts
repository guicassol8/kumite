import { randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import {
  BACK_URL,
  closeRound,
  createRound,
  E2E_PARTICIPANT_NAME,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'

// Visual walkthrough for #229: the round screen's new identity — eyebrow +
// display-weight name, outline status badge, A/B/C position letters, the
// reflowing grid below the #228 breakpoint, and the alert-styled not-found
// state. round-screen.spec.ts (#39) is untouched; this only proves the
// restyle, not the live-update wiring that spec already covers. Prereqs:
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD.
const evidence = (name: string) => `e2e/evidence/229/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `round-screen-identity-e2e-${stamp}@edu.pucrs.br`
const roundName = `Rodada Identidade E2E ${stamp}`

test.describe('round screen identity (#229)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function apiCreatePublishedProblem(
    difficulty: 'easy' | 'hard',
    titles: { pt: string; es: string; en: string },
  ): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: titles.pt, statementMd: 'Enunciado.' },
          { locale: 'es', title: titles.es, statementMd: 'Enunciado.' },
          { locale: 'en', title: titles.en, statementMd: 'Statement.' },
        ],
        testCases: [
          { input: [1, 2], expected: 3, hidden: false },
          { input: [2, 2], expected: 4, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  async function signupThroughUi(page: Page, email: string): Promise<void> {
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('E2E Participante')
    await page.getByTestId('signup-email-input').fill(email)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
  }

  test('desktop table, mobile cards, closed state and not-found all use the identity', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()
    const problemAId = await apiCreatePublishedProblem('easy', {
      pt: 'Soma dos Pares',
      es: 'Suma de Pares',
      en: 'Sum of Pairs',
    })
    const problemBId = await apiCreatePublishedProblem('hard', {
      pt: 'Contar Números Negativos',
      es: 'Contar Números Negativos',
      en: 'Count Negative Numbers',
    })
    const roundId = await createRound(auth, {
      name: roundName,
      durationMinutes: 30,
      problemIds: [problemAId, problemBId],
    })

    // 01 — desktop, round open: eyebrow + display name, outline "Aberta"
    // badge with the red dot, and the reflowing grid as a table.
    await signupThroughUi(page, participantEmail)
    await roundSlot.open(auth, roundId)
    await page.goto(`/rounds/${roundId}`)
    await expect(page.getByTestId('round-detail-status-badge')).toContainText('Aberta', {
      timeout: 15_000,
    })

    const rowA = page.getByTestId(`round-problem-${problemAId}`)
    const rowB = page.getByTestId(`round-problem-${problemBId}`)
    await expect(rowA).toContainText('A')
    await expect(rowA).toContainText('Soma dos Pares')
    await expect(rowB).toContainText('B')
    await expect(rowB).toContainText('Contar Números Negativos')
    // Scoped to <main>: the header (#217) renders its own round-countdown
    // chip (with its own sr-only summary) whenever a round is open.
    await expect(page.getByRole('main').getByTestId('round-countdown')).toBeVisible()
    await expect(page.getByRole('main').getByTestId('round-countdown-summary')).toHaveCount(1)
    await expect(page.getByTestId('round-problems-table')).toHaveAttribute('role', 'table')
    await page.screenshot({ path: evidence('01-desktop-aberta'), fullPage: true })

    // 02 — 390x844: the same rows reflow into cards, no horizontal scroll
    // from this screen's own content, and the desktop-only column header row
    // is hidden. Scoped to <main> rather than the whole document: the header
    // is still the pre-#217 chrome (not wrapped for narrow widths) and
    // already overflows on every authenticated screen today, not just this
    // one — the plan explicitly leaves that fix to #217.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(rowA).toBeVisible()
    await expect(rowB).toBeVisible()
    const [mainScrollWidth, innerWidth] = await page.evaluate(() => [
      document.querySelector('main')?.scrollWidth ?? 0,
      window.innerWidth,
    ])
    expect(mainScrollWidth).toBeLessThanOrEqual(innerWidth)
    await expect(page.getByRole('columnheader').first()).toBeHidden()
    await page.screenshot({ path: evidence('02-celular-cards'), fullPage: true })
    await page.setViewportSize({ width: 1280, height: 800 })

    // 03 — closing it live flips the badge and swaps the countdown for the
    // "Encerrada às HH:mm" text.
    await closeRound(auth, roundId)
    await expect(page.getByTestId('round-detail-status-badge')).toContainText('Encerrada', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('round-detail-closed-at')).toBeVisible()
    await expect(page.getByTestId('round-countdown')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-encerrada'), fullPage: true })

    // 04 — a round id that is a real UUID but does not exist: the alert-styled
    // not-found state, outside any round slot.
    await page.goto(`/rounds/${randomUUID()}`)
    await expect(page.getByTestId('round-detail-not-found')).toBeVisible()
    await page.screenshot({ path: evidence('04-nao-encontrada'), fullPage: true })
  })
})
