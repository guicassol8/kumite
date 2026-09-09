import {
  BACK_URL,
  clearRoundLock,
  closeAnyOpenRound,
  hasOrganizerCredentials,
  organizerAuthHeader,
} from './rounds'

// Runs once, before any worker starts (#150).
//
// Only one round may be open at a time. A previous suite run that was killed
// mid-flight — Ctrl-C, a crashed worker, a spec that predates `roundSlot` —
// leaves its round open for the rest of its 30min duration, and every later run
// then dies on `another_round_open` through no fault of its own. Clearing that
// here, once, is the only safe place to do it: from inside a worker (which is
// what footer.spec.ts used to do) the round being closed is very likely another
// spec's, running right now.

const HEALTH_TIMEOUT_MS = 60_000
const HEALTH_RETRY_MS = 1_000

/** `webServer` and `globalSetup` have no guaranteed order, so wait for the API. */
async function waitForBack(): Promise<boolean> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BACK_URL}/health`)
      if (res.ok) return true
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_RETRY_MS))
  }
  return false
}

export default async function globalSetup(): Promise<void> {
  // A run killed while a worker held the round-close lock leaves the file
  // behind; the next run would then wait `LOCK_STALE_MS` on its first close.
  await clearRoundLock()

  // Same rule as the `test.skip` guards in the specs: without credentials every
  // round-touching spec skips itself, so there is nothing to clean up.
  if (!hasOrganizerCredentials) return

  if (!(await waitForBack())) {
    console.warn(`[e2e] ${BACK_URL} never answered /health — skipping the open-round cleanup`)
    return
  }

  const closed = await closeAnyOpenRound(await organizerAuthHeader())
  for (const round of closed) {
    console.log(`[e2e] closed a leftover open round before starting: ${round}`)
  }
}
