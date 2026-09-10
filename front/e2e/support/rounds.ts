import { rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test as base } from '@playwright/test'

// The round lifecycle every spec that needs an open round used to copy by hand
// (#150). Three things live here that a per-spec copy cannot provide:
//
//   - `roundSlot`, a fixture whose teardown closes every round the test opened.
//     Playwright runs fixture teardown on success, on a failed assertion, on a
//     timeout and on an exception — an inline `close()` at the end of the test
//     runs on none of those but the first. A round left open holds
//     `rounds_single_open_idx` (the single-open-round slot) for its whole
//     duration, so one failing spec used to poison every later one for 30min.
//   - an `another_round_open` failure that names who is holding the slot,
//     instead of a 409 with no owner.
//   - `withRoundLock`, for the assertions that read event-wide round state —
//     "no round is running", "mine is the one that closed last" — which the
//     open-round slot stops protecting the moment a round closes.
//
// Playwright only collects `*.spec.ts` under `testDir`, so this is a helper,
// not a suite.

export const BACK_URL = `http://localhost:${process.env.PORT ?? '3000'}`
export const ORGANIZER_EMAIL = process.env.ORGANIZER_EMAIL ?? ''
export const ORGANIZER_PASSWORD = process.env.ORGANIZER_PASSWORD ?? ''
export const hasOrganizerCredentials = Boolean(ORGANIZER_EMAIL && ORGANIZER_PASSWORD)

// Since #122 the header renders `name ?? email`, so what these specs assert
// there is the name. ORGANIZER_NAME mirrors the constant db:seed writes
// (back/src/db/seed.ts) — the seeded organizer has no env var for it.
export const ORGANIZER_NAME = 'Organização kumite'
export const E2E_PARTICIPANT_NAME = 'E2E Participante'

export type AuthHeader = Record<string, string>

/**
 * Opening is the one step that contends: only one round may be open at a time.
 * What can hold the slot is now always short-lived — another spec's round, for
 * as long as that spec runs — because `globalSetup` closes the leftovers
 * (`db:seed`'s own "Round 1", a round from a previous run) before any worker
 * starts. ~20s is enough for that; longer only delays a real failure.
 */
const OPEN_ATTEMPTS = 10
const OPEN_RETRY_MS = 2_000

let organizerToken: string | undefined

/** Logs the organizer in once per worker process and caches the header. */
export async function organizerAuthHeader(): Promise<AuthHeader> {
  if (!organizerToken) {
    const res = await fetch(`${BACK_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
    })
    const { token } = (await res.json().catch(() => ({}))) as { token?: string }
    // Without this every later request goes out as `Bearer undefined` and the
    // suite blames the first one that answers 401 instead of the login. The
    // usual cause is a database wiped by `pnpm test` and not re-seeded.
    if (!token) {
      throw new Error(
        `organizer login failed for ${ORGANIZER_EMAIL} (HTTP ${res.status}) — is the database seeded?`,
      )
    }
    organizerToken = token
  }
  return { authorization: `Bearer ${organizerToken}` }
}

export type NewRound = {
  name: string
  durationMinutes: number
  problemIds: string[]
}

/**
 * Creates a `draft` round. Fails loudly on a missing id: letting it travel as
 * the literal "undefined" only moves the error to `/organizer/rounds/undefined/open`
 * a full retry window later, pointing at the wrong request.
 */
export async function createRound(auth: AuthHeader, round: NewRound): Promise<string> {
  const res = await fetch(`${BACK_URL}/organizer/rounds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify(round),
  })
  const { id } = (await res.json().catch(() => ({}))) as { id?: string }
  if (!res.ok || !id) {
    throw new Error(`could not create the round "${round.name}" (HTTP ${res.status})`)
  }
  return id
}

type RoundSummary = { id: string; name: string; status: string; closesAt: string | null }

async function listRounds(auth: AuthHeader): Promise<RoundSummary[]> {
  const res = await fetch(`${BACK_URL}/organizer/rounds`, { headers: auth })
  if (!res.ok) throw new Error(`could not list the rounds (HTTP ${res.status})`)
  return (await res.json()) as RoundSummary[]
}

/**
 * Names whoever holds the single-open-round slot, for an error message.
 * Acceptance #3 of #150: an `another_round_open` that says which round.
 */
export async function describeOpenRound(auth: AuthHeader): Promise<string | null> {
  const open = (await listRounds(auth)).find((round) => round.status === 'open')
  if (!open) return null
  return `"${open.name}" (${open.id}, closes at ${open.closesAt ?? 'unknown'})`
}

export async function openRoundWithRetry(auth: AuthHeader, roundId: string): Promise<void> {
  // Nested, this would hold the lock the current holder needs in order to
  // close — 20s of retries that cannot possibly succeed. Say so instead.
  if (lockDepth > 0) {
    throw new Error(
      `openRoundWithRetry called inside withRoundLock (round ${roundId}) — open outside the lock, it is the close that has to wait`,
    )
  }
  for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt++) {
    // One attempt per acquisition, never the whole retry loop: a spec reading
    // the just-closed state holds the lock, and this must not take the slot
    // out from under it.
    const outcome = await withRoundLock(async () => {
      const res = await fetch(`${BACK_URL}/organizer/rounds/${roundId}/open`, {
        method: 'POST',
        headers: auth,
      })
      if (res.ok) return { opened: true as const }
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      return {
        opened: false as const,
        error: body.error ?? `http ${res.status}`,
        status: res.status,
      }
    })
    if (outcome.opened) return
    // Waiting only ever helps against the contended slot. A 401, a 404 or a
    // round that is no longer a draft answers the same way in 20s as it does
    // now, and retrying it just buries the real cause under a timeout.
    if (outcome.error !== 'another_round_open') {
      throw new Error(`could not open round ${roundId}: ${outcome.error} (HTTP ${outcome.status})`)
    }
    if (attempt < OPEN_ATTEMPTS) await new Promise((r) => setTimeout(r, OPEN_RETRY_MS))
  }
  const holder = (await describeOpenRound(auth).catch(() => null)) ?? 'no round (it just closed)'
  throw new Error(
    `could not open round ${roundId} after ${OPEN_ATTEMPTS} attempts: another_round_open — the slot is held by ${holder}`,
  )
}

// The open-round slot serializes specs only while a round is open. It says
// nothing about the instant *after* a close, and "no round is running, and mine
// is the one that closed last" is exactly what the leaderboard's
// `leaderboard-last-closed-label` and the organizer overview's round card are
// showing. With `workers: 2`, the moment a spec closed its round another worker
// could take the freed slot, or close a newer round — and the assertion then
// read a round this spec never chose, or a live round instead of a closed one.
// It failed on a different spec each run (#150, found reviewing #153).
//
// This lock covers the whole transition, both directions: every close, every
// open attempt, and the reads a spec makes in between. It lives in a file
// because Playwright workers are separate processes, and is keyed by the API
// port so two worktrees running their own stack do not share one.
const LOCK_PATH = join(tmpdir(), `kumite-e2e-round-state-${process.env.PORT ?? '3000'}.lock`)
/**
 * A hold cannot outlive the test holding it, and `withRoundLock` releases in a
 * `finally` even on a Playwright timeout — so a lock older than the test
 * timeout belongs to a process that died, not to a slow test.
 */
const LOCK_STALE_MS = 35_000
const LOCK_POLL_MS = 100
const LOCK_WAIT_MS = 60_000

/** Depth, not a boolean: `closeRound` re-enters it from inside the callback. */
let lockDepth = 0

async function acquireLock(): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try {
      // `wx` fails when the file exists, and does so atomically — that is the
      // whole mutex.
      await writeFile(LOCK_PATH, `${process.pid}`, { flag: 'wx' })
      return
    } catch {
      // A worker killed mid-hold would otherwise block the suite forever, so a
      // lock older than any legitimate hold is taken over rather than waited on.
      const age = await stat(LOCK_PATH)
        .then((s) => Date.now() - s.mtimeMs)
        .catch(() => null)
      if (age !== null && age > LOCK_STALE_MS) {
        await rm(LOCK_PATH, { force: true })
        continue
      }
      if (Date.now() > deadline) {
        throw new Error(`timed out after ${LOCK_WAIT_MS}ms waiting for ${LOCK_PATH}`)
      }
      await new Promise((r) => setTimeout(r, LOCK_POLL_MS))
    }
  }
}

/**
 * Runs `body` with no other worker opening or closing a round meanwhile. Wrap a
 * close together with whatever the spec then reads about "the last closed
 * round"; a spec that only looks at its own round does not need this.
 *
 * `roundSlot.open` must stay OUTSIDE: it waits for whoever holds the slot to
 * close, and that close needs this same lock — `openRoundWithRetry` therefore
 * takes the lock per attempt and drops it between them, and refuses to run
 * nested (below) rather than hanging until the retries run out.
 */
export async function withRoundLock<T>(body: () => Promise<T>): Promise<T> {
  if (lockDepth > 0) {
    lockDepth++
    try {
      return await body()
    } finally {
      lockDepth--
    }
  }
  await acquireLock()
  lockDepth = 1
  try {
    return await body()
  } finally {
    lockDepth = 0
    await rm(LOCK_PATH, { force: true })
  }
}

/** Only `globalSetup` may call this: a lock left behind by a killed run. */
export async function clearRoundLock(): Promise<void> {
  await rm(LOCK_PATH, { force: true })
}

/**
 * Idempotent: a round that is already closed (or gone) is the desired state,
 * not an error. The fixture teardown below relies on that — it closes rounds a
 * test may well have closed itself as part of an assertion.
 *
 * Every close goes through the lock, so a spec holding it across its own close
 * really does get an uncontended read of the last-closed round.
 */
export async function closeRound(auth: AuthHeader, roundId: string): Promise<void> {
  return withRoundLock(async () => {
    const res = await fetch(`${BACK_URL}/organizer/rounds/${roundId}/close`, {
      method: 'POST',
      headers: auth,
    })
    if (res.ok) return
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (body.error === 'round_not_open' || body.error === 'not_found') return
    throw new Error(
      `could not close round ${roundId}: ${body.error ?? `http ${res.status}`} — it still holds the open-round slot`,
    )
  })
}

/**
 * Closes whatever holds the slot right now and returns what it closed.
 * Only `globalSetup` may call this: from inside a worker it is a race, because
 * the round it closes is very likely another spec's (see #150 / footer.spec.ts).
 */
export async function closeAnyOpenRound(auth: AuthHeader): Promise<string[]> {
  const open = (await listRounds(auth)).filter((round) => round.status === 'open')
  for (const round of open) await closeRound(auth, round.id)
  return open.map((round) => `"${round.name}" (${round.id})`)
}

export type RoundSlot = {
  /** Opens the round and puts it under the teardown's care. */
  open: (auth: AuthHeader, roundId: string) => Promise<void>
  /** Puts a round opened elsewhere (through the UI) under the same care. */
  register: (roundId: string) => void
}

export const test = base.extend<{ roundSlot: RoundSlot }>({
  roundSlot: async ({}, use) => {
    const opened = new Set<string>()

    await use({
      async open(auth, roundId) {
        // Registered *before* the attempt: a round that failed to open is still
        // a draft, and closing a draft is a no-op here — while an open that
        // succeeded and then threw mid-assertion is exactly the leak this exists
        // to stop.
        opened.add(roundId)
        await openRoundWithRetry(auth, roundId)
      },
      register(roundId) {
        opened.add(roundId)
      },
    })

    if (opened.size === 0) return
    const auth = await organizerAuthHeader()
    for (const roundId of opened) await closeRound(auth, roundId)
  },
})

export { expect } from '@playwright/test'
