import {
  BACK_URL,
  createRound,
  E2E_PARTICIPANT_NAME,
  expect,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  organizerAuthHeader,
  test,
} from './support/rounds'
import { createTeamThroughUi } from './support/teams-ui'

// Visual walkthrough for #184: getRoundRanking used to list every active team
// in a round's ranking, even one that never submitted in it, zeroed at the
// back of the table. Two teams here, only one of which submits: the round
// tab must show only the participant, never the other team.
// Prereqs (like leaderboard.spec.ts):
//   docker compose up -d && pnpm db:migrate && pnpm db:seed
const evidence = (name: string) => `e2e/evidence/184/${name}.png`

const PASSWORD = 'supersecret'
const stamp = Date.now()
const participantEmail = `phantom-e2e-${stamp}@edu.pucrs.br`
const ghostEmail = `phantom-e2e-ghost-${stamp}@edu.pucrs.br`
const teamName = `Participante Fantasma ${stamp}`
const ghostTeamName = `Time Fantasma ${stamp}`
const roundName = `Rodada Fantasma ${stamp}`

test.describe('leaderboard phantom teams (#184)', () => {
  test.skip(!ORGANIZER_EMAIL || !ORGANIZER_PASSWORD, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function apiCreatePublishedProblem(): Promise<string> {
    const auth = await organizerAuthHeader()
    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy' }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [
          { locale: 'pt', title: 'Identidade', statementMd: 'Devolva a entrada.' },
          { locale: 'es', title: 'Identidad', statementMd: 'Devuelve la entrada.' },
          { locale: 'en', title: 'Identity', statementMd: 'Return the input.' },
        ],
        testCases: [
          { input: 1, expected: 1, hidden: false },
          { input: 2, expected: 2, hidden: true },
        ],
      }),
    })
    await fetch(`${BACK_URL}/organizer/problems/${id}/publish`, { method: 'POST', headers: auth })
    return id
  }

  async function apiSignupAndLogin(email: string): Promise<string> {
    await fetch(`${BACK_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Fantasma',
        email,
        password: PASSWORD,
        code: 'PUCRS2026',
      }),
    })
    const res = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    const { token } = (await res.json()) as { token: string }
    return token
  }

  async function apiCreateTeam(token: string, name: string): Promise<void> {
    await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    })
  }

  async function apiSubmitSolution(token: string, problemId: string, roundId: string) {
    await fetch(`${BACK_URL}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        problemId,
        roundId,
        workspace: {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'kumite_solve',
                id: 'raiz',
                inputs: { RETURN: { block: { type: 'kumite_input', id: 'entrada' } } },
              },
            ],
          },
        },
      }),
    })
  }

  test('shows only the participating team, never the one that stayed on the sidelines', async ({
    page,
    roundSlot,
  }) => {
    const auth = await organizerAuthHeader()

    // The ghost team exists and is active event-wide, but never touches this
    // round — set up over the API since only its absence matters.
    const ghostToken = await apiSignupAndLogin(ghostEmail)
    await apiCreateTeam(ghostToken, ghostTeamName)

    // The participant goes through the UI, same as leaderboard.spec.ts, so
    // the walkthrough shows the real signup + team-creation flow once.
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('E2E Participante')
    await page.getByTestId('signup-email-input').fill(participantEmail)
    await page.getByTestId('signup-password-input').fill(PASSWORD)
    await page.getByTestId('signup-confirm-password-input').fill(PASSWORD)
    await page.getByTestId('signup-code-input').fill('PUCRS2026')
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('header-user-email')).toHaveText(E2E_PARTICIPANT_NAME)
    await page.getByTestId('header-teams-link').click()
    await createTeamThroughUi(page, teamName)

    const problemId = await apiCreatePublishedProblem()
    const roundId = await createRound(auth, {
      name: roundName,
      durationMinutes: 30,
      problemIds: [problemId],
    })
    await roundSlot.open(auth, roundId)

    // 01 — the round just opened, nobody has submitted yet: the round tab
    // shows the round-specific empty state, not a table with two zeroed rows.
    await page.getByTestId('header-leaderboard-link').click()
    await expect(page).toHaveURL(/\/leaderboard$/)
    await expect(page.getByTestId('leaderboard-empty')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('leaderboard-empty')).toContainText(
      'Ninguém submeteu nesta rodada ainda.',
    )
    await page.screenshot({ path: evidence('01-rodada-sem-submissoes'), fullPage: true })

    // 02 — the participant's team submits; the ghost team never does. The
    // round tab's table must show only the participant, live over SSE.
    const token = await page.evaluate(() => window.localStorage.getItem('kumite-token'))
    if (!token) throw new Error('expected a session token in localStorage after signup')
    await apiSubmitSolution(token, problemId, roundId)

    await expect(page.getByTestId('leaderboard-table')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(teamName)).toBeVisible()
    await expect(page.getByText(ghostTeamName)).toHaveCount(0)
    await page.screenshot({ path: evidence('02-so-o-participante-aparece'), fullPage: true })
  })
})
