import type { Page } from '@playwright/test'

import {
  BACK_URL,
  closeRound,
  createRound,
  ORGANIZER_EMAIL,
  ORGANIZER_PASSWORD,
  openRoundWithRetry,
  organizerAuthHeader,
} from './rounds'

// Shared setup for every spec that only needs to *view* the block editor.
// #7 moved it behind a real problem id (`/problem/$id`), so each of those
// specs used to repeat the same seeding by hand. The round is opened and
// immediately closed: none of these specs submits, and a round left open would
// hold the single-open-round slot against every other spec running in
// parallel. A `draft` round is not an option — `getProblem` answers 404 while
// the problem is not in a non-draft round (`problems.service.ts`).
//
// The round lifecycle itself lives in `./rounds` (#150) — this file only
// composes it.
//
// Playwright only collects `*.spec.ts` under `testDir`, so this file is a
// helper, not a suite.

export { BACK_URL, hasOrganizerCredentials, ORGANIZER_EMAIL, ORGANIZER_PASSWORD } from './rounds'

const PASSWORD = 'supersecret'
const TOKEN_KEY = 'kumite-token'

/**
 * `beforeAll` inherits the 30s test timeout, which is shorter than the open
 * retry window — the hook would die before the retries did. Every fixture
 * consumer raises it to this instead. 60s covers the ~20s of retries in
 * `openRoundWithRetry` plus the six requests around them; it used to be 120s,
 * back when that window was ~90s.
 */
export const EDITOR_FIXTURE_TIMEOUT_MS = 60_000

export type EditorFixture = {
  problemId: string
  participantToken: string
}

/**
 * Seeds a published "Soma dos Pares" problem inside a closed round and a
 * participant able to open it. The three visible test cases mirror
 * `somaDosParesProblem.examples` exactly; the hidden one only exists because
 * publish requires it.
 *
 * `label` names the round and the participant, so a failing run says which
 * spec seeded what.
 */
export async function seedEditorFixture(label: string): Promise<EditorFixture> {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const auth = await organizerAuthHeader()

  const created = await fetch(`${BACK_URL}/organizer/problems`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ difficulty: 'easy' }),
  })
  const { id: problemId } = (await created.json()) as { id?: string }
  // Without this the id travels as the literal "undefined" through PATCH,
  // publish and the round, and the suite blames the round open a full retry
  // window later instead of the request that actually broke.
  if (!problemId) {
    throw new Error(`could not create the problem (HTTP ${created.status})`)
  }

  await fetch(`${BACK_URL}/organizer/problems/${problemId}`, {
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
  await fetch(`${BACK_URL}/organizer/problems/${problemId}/publish`, {
    method: 'POST',
    headers: auth,
  })

  const roundId = await createRound(auth, {
    name: `${label} E2E ${Date.now()}`,
    durationMinutes: 30,
    problemIds: [problemId],
  })
  // `roundSlot` (support/rounds.ts) is a per-test fixture and this runs in
  // `beforeAll`, where Playwright offers no test fixtures — so the safety here
  // is that nothing may sit between these two lines. A round left open holds
  // the single-open-round slot for its whole 30min duration (#150), and
  // `closeRound` throws instead of failing in silence.
  await openRoundWithRetry(auth, roundId)
  await closeRound(auth, roundId)

  const participantEmail = `${slug}-e2e-${Date.now()}@edu.pucrs.br`
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Participante',
      email: participantEmail,
      password: PASSWORD,
      code: 'PUCRS2026',
    }),
  })
  const participantLogin = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: participantEmail, password: PASSWORD }),
  })
  const { token: participantToken } = (await participantLogin.json()) as { token: string }

  return { problemId, participantToken }
}

/** Signs the page in via the stored token instead of walking the login UI. */
export async function seedParticipantToken(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [TOKEN_KEY, token],
  )
}
