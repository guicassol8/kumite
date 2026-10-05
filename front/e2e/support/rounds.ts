import { rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test as base, type TestInfo } from '@playwright/test'

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
//   - `withNoOpenRound`, for the reads that need no round live anywhere —
//     which holding the lock alone does not give (#386).
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
 * Opening is the one step that contends: only one round may be open at a time,
 * and whoever holds the slot holds it for as long as its spec takes to close —
 * not a few seconds. `globalSetup` closes the leftovers (`db:seed`'s own
 * "Round 1", a round from a previous run) before any worker starts, so the
 * holder is always another spec, and some hold it far past the ten 2s retries
 * this used to allow (#382): `problem-attempt-in-round` across two
 * rounds and their submission cooldowns, `sse-single-connection` for ~34s
 * with a 180s ceiling (`editorTestTimeout(2, 60_000)`). So a waiter waits by
 * deadline, not by attempts: 180s, the longest healthy hold cited in #382. A
 * holder stuck to its own ceiling is a real failure already, and the error
 * this one throws after it names that holder.
 *
 * The time spent waiting is added to the running test's (or hook's) timeout
 * as it passes (`timeoutExtender`), so no spec budgets for another spec's
 * round — a `beforeAll` with 60s survives a 70s holder.
 */
const SLOT_WAIT_MS = 180_000
/**
 * With two workers the race is always one holder against one waiter, and the
 * holder may close one round and open its next within a couple of seconds — a
 * 2s poll used to miss those gaps; 500ms rarely does.
 */
const SLOT_POLL_MS = 500

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
 * after a whole wait for the slot, pointing at the wrong request.
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

/**
 * Returns a function that adds `ms` to the timeout of whatever test or hook is
 * running, so a wait for another spec's round is not paid out of this one's
 * budget. Outside a test (`globalSetup`) there is nothing to extend, and a
 * timeout of 0 is none.
 *
 * In a test body, `testInfo.timeout` is the running timeout and is simply
 * raised. In a `beforeAll`/`afterAll` it is NOT: those run on a timeout slot
 * of their own, while `testInfo.timeout` keeps reading the test's (Playwright
 * 1.62.1, `TimeoutManager.defaultSlot()`) — so `setTimeout(timeout + ms)`
 * there would set a 60s hook to the 30s test default plus the wait, shrinking
 * it (#382). Playwright has no public read of a hook's timeout, so a hook says
 * what it set itself to: `hookTimeoutMs`.
 */
function timeoutExtender(hookTimeoutMs?: number): (ms: number) => void {
  let hookTimeout = hookTimeoutMs
  return (ms) => {
    if (ms <= 0) return
    let info: TestInfo
    try {
      info = base.info()
    } catch {
      return
    }
    if (hookTimeout !== undefined) {
      if (hookTimeout === 0) return
      hookTimeout += ms
      info.setTimeout(hookTimeout)
      return
    }
    if (info.timeout === 0) return
    info.setTimeout(info.timeout + ms)
  }
}

/**
 * Polls, outside the lock, until no round holds the slot. Every poll that
 * found it held passes the time it took to `extend`. Past `deadline` it throws
 * `failure`, naming the holder and how long it waited.
 */
async function waitForFreeSlot(
  auth: AuthHeader,
  wait: { startedAt: number; deadline: number; extend: (ms: number) => void },
  failure: string,
): Promise<void> {
  for (;;) {
    const polledAt = Date.now()
    const holder = await describeOpenRound(auth)
    if (holder === null) return
    if (Date.now() > wait.deadline) {
      const waited = Math.round((Date.now() - wait.startedAt) / 1000)
      throw new Error(`${failure} — the slot is still held by ${holder} after ${waited}s`)
    }
    await new Promise((r) => setTimeout(r, SLOT_POLL_MS))
    wait.extend(Date.now() - polledAt)
  }
}

function startSlotWait(hookTimeoutMs?: number) {
  const startedAt = Date.now()
  return { startedAt, deadline: startedAt + SLOT_WAIT_MS, extend: timeoutExtender(hookTimeoutMs) }
}

export type SlotWaitOptions = {
  /**
   * Called from a `beforeAll`/`afterAll`? The timeout that hook set for itself
   * (`test.setTimeout(...)`), which the wait then extends — see
   * `timeoutExtender` for why it cannot be read. Leave it out in a test body.
   */
  hookTimeoutMs?: number
}

export async function openRoundWithRetry(
  auth: AuthHeader,
  roundId: string,
  options: SlotWaitOptions = {},
): Promise<void> {
  // Nested, this would hold the lock the current holder needs in order to
  // close — a wait that cannot possibly succeed. Say so instead.
  if (lockDepth > 0) {
    throw new Error(
      `openRoundWithRetry called inside withRoundLock (round ${roundId}) — open outside the lock, it is the close that has to wait`,
    )
  }
  const wait = startSlotWait(options.hookTimeoutMs)
  for (;;) {
    await waitForFreeSlot(auth, wait, `could not open round ${roundId}: another_round_open`)
    // One attempt per acquisition, never the whole wait: a spec reading the
    // just-closed state holds the lock, and this must not take the slot out
    // from under it.
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
    // round that is no longer a draft answers the same way in three minutes
    // as it does now, and waiting on it just buries the real cause.
    if (outcome.error !== 'another_round_open') {
      throw new Error(`could not open round ${roundId}: ${outcome.error} (HTTP ${outcome.status})`)
    }
    // Another worker took the freed slot first. Losing that race is not a
    // failure: back to waiting, on the same deadline.
  }
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
// open attempt, and the reads a spec makes in between. It freezes the state as
// it is — which is not the same as "no round is open": holding it while another
// spec's round is live keeps that round live, because its close needs this
// same lock. A read that needs the slot *free* waits for that first, outside
// the lock, through `withNoOpenRound` (#386). It lives in a file
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
 * nested (below) rather than hanging until its wait runs out.
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

/**
 * Runs `body` under `withRoundLock` with no round open, and none opening until
 * it returns — the third state the lock alone cannot give: "the slot is free,
 * and stays free while I read". For reads that depend on *no* round being live
 * anywhere in the event, e.g. the leaderboard's default tab and its
 * `leaderboard-last-closed-label` (#386).
 *
 * The wait happens OUTSIDE the lock, then the lock is taken and the slot
 * re-checked: someone may have opened in between, in which case the lock is
 * dropped and the wait starts over. Keep `body` well under `LOCK_STALE_MS` —
 * it holds the lock throughout, and a hold older than that is taken over.
 * Call it from a test body: the wait extends the test's timeout, which a hook
 * cannot have read back (`timeoutExtender`).
 */
export async function withNoOpenRound<T>(auth: AuthHeader, body: () => Promise<T>): Promise<T> {
  // Nested, the wait below would hold the lock the slot's owner needs in order
  // to close — a guaranteed deadlock. Same refusal as `openRoundWithRetry`.
  if (lockDepth > 0) {
    throw new Error(
      'withNoOpenRound called inside withRoundLock — it waits for a close, and that close needs the lock',
    )
  }
  // The same wait and deadline as an open (`SLOT_WAIT_MS`): with a shorter or
  // slower one, every gap between two rounds would go to the waiting opens.
  const wait = startSlotWait()
  for (;;) {
    await waitForFreeSlot(auth, wait, 'withNoOpenRound: no round closed in time')
    const outcome = await withRoundLock(async () => {
      if ((await describeOpenRound(auth)) !== null) return { ran: false as const }
      return { ran: true as const, value: await body() }
    })
    if (outcome.ran) return outcome.value
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
