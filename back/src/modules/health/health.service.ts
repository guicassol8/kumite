import { sql } from 'drizzle-orm'

import type { Db } from '../../db/client'

import type { Health } from './health.schema'

// How long the database gets to answer `select 1` before the probe reports
// `degraded` (#287). Short on purpose: a liveness check that waits as long as
// a slow query would is not a liveness check.
export const HEALTH_DB_TIMEOUT_MS = 500

/** The cheapest round trip Postgres can answer. */
export async function pingDatabase(db: Db): Promise<void> {
  await db.execute(sql`select 1`)
}

/**
 * `ok` when `ping` settles in time, `degraded` when it rejects or hangs past
 * `timeoutMs`. The probe is injected so this stays a plain function with no
 * I/O of its own — the route hands it `pingDatabase`.
 */
export async function checkHealth(
  ping: () => Promise<unknown>,
  timeoutMs = HEALTH_DB_TIMEOUT_MS,
): Promise<Health> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('health: database ping timed out')), timeoutMs)
  })
  try {
    await Promise.race([ping(), timeout])
    return { status: 'ok' }
  } catch {
    return { status: 'degraded' }
  } finally {
    clearTimeout(timer)
  }
}
