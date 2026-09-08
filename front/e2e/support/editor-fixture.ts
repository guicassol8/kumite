import type { Page } from '@playwright/test'

// Shared setup for every spec that only needs to *view* the block editor.
// #7 moved it behind a real problem id (`/problem/$id`), so each of those
// specs used to repeat the same seeding by hand. The round is opened and
// immediately closed: none of these specs submits, and a round left open would
// hold the single-open-round slot against every other spec running in
// parallel. A `draft` round is not an option — `getProblem` answers 404 while
// the problem is not in a non-draft round (`problems.service.ts`).
//
// Playwright only collects `*.spec.ts` under `testDir`, so this file is a
// helper, not a suite.

export const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
export const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
export const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
export const hasOrganizerCredentials = Boolean(ORGANIZER_EMAIL && ORGANIZER_PASSWORD)

const PASSWORD = 'supersecret'
const TOKEN_KEY = 'kumite-token'

/** Opening is the one step that contends: only one round may be open at a time. */
const OPEN_ATTEMPTS = 5
const OPEN_RETRY_MS = 1_000

export type EditorFixture = {
  problemId: string
  participantToken: string
}

async function openWithRetry(roundId: string, auth: Record<string, string>): Promise<void> {
  let lastError = 'unknown'
  for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt++) {
    const res = await fetch(`${BACK_URL}/organizer/rounds/${roundId}/open`, {
      method: 'POST',
      headers: auth,
    })
    if (res.ok) return
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    lastError = body.error ?? `http ${res.status}`
    // The other holder closes its round milliseconds after opening it, so a
    // short backoff is enough; failing loudly beats leaving the problem in a
    // draft round, where the editor would just 404 with no explanation.
    if (attempt < OPEN_ATTEMPTS) await new Promise((r) => setTimeout(r, OPEN_RETRY_MS))
  }
  throw new Error(`could not open the round after ${OPEN_ATTEMPTS} attempts: ${lastError}`)
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

  const orgLogin = await fetch(`${BACK_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
  })
  const { token: orgToken } = (await orgLogin.json()) as { token: string }
  const auth = { authorization: `Bearer ${orgToken}` }

  const created = await fetch(`${BACK_URL}/organizer/problems`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ difficulty: 'easy' }),
  })
  const { id: problemId } = (await created.json()) as { id: string }

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

  const roundRes = await fetch(`${BACK_URL}/organizer/rounds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({
      name: `${label} E2E ${Date.now()}`,
      durationMinutes: 30,
      problemIds: [problemId],
    }),
  })
  const { id: roundId } = (await roundRes.json()) as { id: string }
  await openWithRetry(roundId, auth)
  await fetch(`${BACK_URL}/organizer/rounds/${roundId}/close`, { method: 'POST', headers: auth })

  const participantEmail = `${slug}-e2e-${Date.now()}@edu.pucrs.br`
  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: participantEmail, password: PASSWORD, code: 'PUCRS2026' }),
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
