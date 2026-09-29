// The "local databases only" guard shared by every script that wipes or
// creates a database: db:reset (#287), db:create and the test suite's
// globalSetup (#392). Kept free of `../config` so it can run where config.ts's
// env validation must not (the vitest main process).

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Refuses anything that is not plainly a local database. `tool` names the
 * caller in the message. The only thing standing between these scripts and
 * production is `DATABASE_URL` — which, in the VPS container, points at the
 * `db` service. `pg_dump`/`psql` by hand is the path for anything that is not
 * local.
 */
export function assertLocalDatabaseUrl(url: string, tool = 'db:reset'): void {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  } catch {
    throw new Error(`${tool}: DATABASE_URL is not a URL it can reason about: ${url}`)
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `${tool} refuses to run against "${host}": only a local database (${[...LOCAL_HOSTS].join(', ')}) may be wiped or created.`,
    )
  }
}
