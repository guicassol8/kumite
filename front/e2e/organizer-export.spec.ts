import { readFileSync } from 'node:fs'

import type { Download, Page } from '@playwright/test'

import {
  BACK_URL,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_NAME,
  ORGANIZER_PASSWORD,
  test,
} from './support/rounds'

// Visual walkthrough for #278. Prereqs (like organizer-overview.spec.ts):
//   pnpm db:migrate && pnpm db:seed
// Needs ORGANIZER_EMAIL/ORGANIZER_PASSWORD in the environment.
const evidence = (name: string) => `e2e/evidence/278/${name}.png`

// Signups and team names are unique event-wide and the dev DB is shared
// across worktrees and reruns, so every fixture carries a stamp.
const stamp = Date.now()
const PARTICIPANT_PASSWORD = 'supersecret'

// Written via fromCharCode, never as a literal U+FEFF in the source: biome
// rewrites the escape '\uFEFF' into the raw character, which is invisible in
// a diff and in review (same reason as blocks/src/fixtures).
const BOM = String.fromCharCode(0xfeff)
const CRLF = '\r\n'

/** Same derivation as both the back's Content-Disposition and the front's
 * exportFilename — UTC, so this never fails at 21:00 in Porto Alegre. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

test.describe('organizer export', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function loginAsOrganizer(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill(ORGANIZER_EMAIL)
    await page.getByTestId('login-password-input').fill(ORGANIZER_PASSWORD)
    await page.getByTestId('login-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(ORGANIZER_NAME)
  }

  // A team is what makes the ranking CSV have a data row at all: the event
  // ranking lists every active team, scored or not. Without one the file
  // would be a lone header and the "one row per team" criterion would be
  // vacuously true.
  // `slug` keeps each test's participant distinct: one account can only ever
  // be in one team, so a shared e-mail would make the second createTeam a
  // silent `already_in_team` and leave that test asserting on a team that
  // was never created.
  async function apiCreateTeam(name: string, slug: string): Promise<void> {
    const email = `export-e2e-${slug}-${stamp}@edu.pucrs.br`
    await fetch(`${BACK_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Exportacao',
        email,
        password: PARTICIPANT_PASSWORD,
        code: 'PUCRS2026',
      }),
    })
    const login = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PARTICIPANT_PASSWORD }),
    })
    const { token } = (await login.json()) as { token: string }
    await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    })
  }

  async function openExportMenu(page: Page) {
    await page.getByTestId('export-menu-trigger').click()
    await expect(page.getByTestId('export-menu-json')).toBeVisible()
  }

  /** Opens the menu, picks one item and waits for the browser to actually
   * receive a file — `waitForEvent('download')` fires on the real download,
   * so a broken blob URL fails here rather than passing quietly. */
  async function downloadFrom(page: Page, testId: string): Promise<Download> {
    await openExportMenu(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(testId).click(),
    ])
    return download
  }

  async function readDownload(download: Download): Promise<Buffer> {
    const path = await download.path()
    expect(path).toBeTruthy()
    return readFileSync(path as string)
  }

  test('baixa os tres CSVs, com BOM, ponto e virgula e uma linha por time', async ({ page }) => {
    const teamName = `Export CSV ${stamp}`
    await apiCreateTeam(teamName, 'csv')

    await loginAsOrganizer(page)
    await page.goto('/organizer')
    await expect(page.getByTestId('overview-heading')).toBeVisible()

    await openExportMenu(page)
    await page.screenshot({ path: evidence('01-menu-exportar-aberto'), fullPage: true })
    await page.keyboard.press('Escape')

    const ranking = await downloadFrom(page, 'export-menu-csv-ranking')
    expect(ranking.suggestedFilename()).toBe(`kumite-ranking-${today()}.csv`)

    const bytes = await readDownload(ranking)
    // The three bytes that make Excel read "Mérida" as "Mérida".
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])

    const text = bytes.toString('utf8')
    expect(text.startsWith(BOM)).toBe(true)
    const rows = text.slice(BOM.length).split(CRLF).filter(Boolean)
    expect(rows[0]?.startsWith('posicao;time;pontos;tentativas;tempo_ms')).toBe(true)
    // One column per round and per problem: the header is never just the five
    // fixed columns once the event has a round.
    expect(rows[0]?.split(';').length).toBeGreaterThanOrEqual(5)
    // One row per team, and the team created above is one of them.
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.slice(1).some((row) => row.includes(teamName))).toBe(true)
    // Every data row has as many cells as the header — a delimiter that
    // leaked out of a quoted field would show up right here.
    const headerCells = rows[0]?.split(';').length
    for (const row of rows.slice(1)) {
      expect(row.split(';').length).toBe(headerCells)
    }

    const teams = await downloadFrom(page, 'export-menu-csv-teams')
    expect(teams.suggestedFilename()).toBe(`kumite-teams-${today()}.csv`)
    const teamsText = (await readDownload(teams)).toString('utf8')
    expect(
      teamsText.startsWith(`${BOM}time;congelado;membro;email;universidade;papel${CRLF}`),
    ).toBe(true)
    expect(teamsText).toContain(teamName)

    const submissions = await downloadFrom(page, 'export-menu-csv-submissions')
    expect(submissions.suggestedFilename()).toBe(`kumite-submissions-${today()}.csv`)
    const submissionsText = (await readDownload(submissions)).toString('utf8')
    expect(
      submissionsText.startsWith(
        `${BOM}time;rodada;letra;problem_id;tentativas;melhor_score;melhor_maximo;melhor_aceita_em${CRLF}`,
      ),
    ).toBe(true)

    // No error surfaced along the way, and the screen is back to normal.
    await expect(page.getByTestId('export-menu-error')).toHaveCount(0)
    await page.screenshot({ path: evidence('02-apos-os-downloads'), fullPage: true })
  })

  test('baixa o JSON completo com todas as secoes', async ({ page }) => {
    const teamName = `Export JSON ${stamp}`
    await apiCreateTeam(teamName, 'json')

    await loginAsOrganizer(page)
    await page.goto('/organizer')
    await expect(page.getByTestId('overview-heading')).toBeVisible()

    const download = await downloadFrom(page, 'export-menu-json')
    expect(download.suggestedFilename()).toBe(`kumite-export-${today()}.json`)

    const bundle = JSON.parse((await readDownload(download)).toString('utf8')) as {
      generatedAt: string
      rounds: unknown[]
      ranking: { event: { teams: { teamName: string }[] }; rounds: unknown[] }
      teams: { teams: { name: string }[] }
      removedTeams: unknown[]
      submissions: unknown[]
    }

    expect(typeof bundle.generatedAt).toBe('string')
    expect(Array.isArray(bundle.rounds)).toBe(true)
    expect(Array.isArray(bundle.ranking.rounds)).toBe(true)
    expect(Array.isArray(bundle.removedTeams)).toBe(true)
    expect(Array.isArray(bundle.submissions)).toBe(true)
    // The same team is in both halves — the listing and the ranking — which
    // is the coherence the first acceptance criterion asks for.
    expect(bundle.teams.teams.some((team) => team.name === teamName)).toBe(true)
    expect(bundle.ranking.event.teams.some((team) => team.teamName === teamName)).toBe(true)

    await expect(page.getByTestId('export-menu-error')).toHaveCount(0)
    await page.screenshot({ path: evidence('03-json-baixado'), fullPage: true })
  })
})
