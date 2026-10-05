import type { Page } from '@playwright/test'

import {
  BACK_URL,
  closeRound,
  createRound,
  E2E_PARTICIPANT_NAME,
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

/**
 * Password every participant this fixture creates is signed up with.
 * Exported so a spec that has to log a second account in through the real
 * login form (#175) does not have to duplicate the literal.
 */
export const PARTICIPANT_PASSWORD = 'supersecret'
const TOKEN_KEY = 'kumite-token'

/**
 * The `beforeAll` budget of every fixture consumer: each one calls
 * `test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)` before `seedEditorFixture`. It
 * pays for the requests only. Waiting for another spec to free the
 * open-round slot extends the hook by the time waited (`openRoundWithRetry`,
 * up to `SLOT_WAIT_MS`, #382), which is why `seedEditorFixture` passes this
 * value on: Playwright has no public read of a hook's own timeout.
 */
export const EDITOR_FIXTURE_TIMEOUT_MS = 60_000

export type EditorFixture = {
  problemId: string
  participantToken: string
  /**
   * The id behind `participantToken`. A spec that seeds a saved workspace by
   * hand needs it: the storage key carries the owner since #175.
   */
  participantId: string
}

export type SeededParticipant = {
  email: string
  password: string
  token: string
  id: string
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
  // `closeRound` throws instead of failing in silence. Every caller is a
  // `beforeAll` that set itself to EDITOR_FIXTURE_TIMEOUT_MS, which the wait
  // for the slot extends.
  await openRoundWithRetry(auth, roundId, { hookTimeoutMs: EDITOR_FIXTURE_TIMEOUT_MS })
  await closeRound(auth, roundId)

  const { token: participantToken, id: participantId } = await seedParticipant(label)

  return { problemId, participantToken, participantId }
}

/**
 * Signs a brand-new participant up and logs them in, returning the credentials
 * plus a token. `seedEditorFixture` uses it for the account it hands back, and
 * a spec that needs a *second* account in the same fixture (the next user on
 * the same browser, #175) calls it directly.
 *
 * The address carries `Date.now()` and a random suffix: two calls in the same
 * millisecond would otherwise collide on the unique email, and the second
 * signup would quietly answer with the first account.
 *
 * `name` is what the header renders. It defaults to the shared label, and a
 * spec that puts two accounts on screen passes its own so the screenshots say
 * which one is looking (#175).
 */
export async function seedParticipant(
  label: string,
  name = E2E_PARTICIPANT_NAME,
): Promise<SeededParticipant> {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const email = `${slug}-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@edu.pucrs.br`

  await fetch(`${BACK_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
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
  const { token } = (await login.json()) as { token?: string }
  if (!token) {
    throw new Error(`could not log the seeded participant in (HTTP ${login.status})`)
  }

  return { email, password: PARTICIPANT_PASSWORD, token, id: await participantIdOf(token) }
}

/** Who a participant token belongs to, straight from the API. */
export async function participantIdOf(token: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
  const { id } = (await res.json()) as { id?: string }
  if (!id) throw new Error(`could not read the participant id (HTTP ${res.status})`)
  return id
}

/**
 * Where the editor keeps a participant's saved workspace. Mirrors
 * `src/lib/workspace-storage.ts`: the key carries the owner since #175, and a
 * spec that seeds one by hand under the old problem-only name would be writing
 * where nothing reads — the bootstrap sweep deletes those on sight.
 */
export function workspaceStorageKey(userId: string, problemId: string): string {
  return `kumite:workspace:${userId}:${problemId}`
}

/** Signs the page in via the stored token instead of walking the login UI. */
export async function seedParticipantToken(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [TOKEN_KEY, token],
  )
}
