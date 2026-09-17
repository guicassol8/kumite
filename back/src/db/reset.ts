import { is, sql } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

import { env } from '../config'
import type { Db } from './client'
import { createDb } from './client'
import * as schema from './schema'
import { seed } from './seed'

// The one sanctioned way to put a local database back in a known state
// (#287): every table emptied, then the seed. It replaces the `TRUNCATE …
// CASCADE` each session used to reinvent before the hurl suite, and it is what
// db:seed's event_config reset used to do for the test suites before #287
// moved that reset out of the production path.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Refuses anything that is not plainly a local database. This script wipes
 * every table, and the only thing standing between it and production is
 * `DATABASE_URL` — which, in the VPS container, points at the `db` service.
 * `pg_dump`/`psql` by hand is the path for anything that is not local.
 */
export function assertLocalDatabaseUrl(url: string): void {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  } catch {
    throw new Error(`db:reset: DATABASE_URL is not a URL it can reason about: ${url}`)
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `db:reset refuses to run against "${host}": it truncates every table, and only a local database (${[...LOCAL_HOSTS].join(', ')}) may be wiped.`,
    )
  }
}

/** Every table drizzle knows about — derived from the schema module so a new
 * table can never be forgotten here. */
export function allTables(): PgTable[] {
  // Widened to unknown first: the schema module also exports pgEnums, and a
  // type predicate must be assignable to the union it narrows from.
  return (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
    is(value, PgTable),
  )
}

export async function resetDatabase(db: Db): Promise<void> {
  const tables = allTables()
  await db.execute(
    sql`truncate table ${sql.join(
      tables.map((table) => sql`${table}`),
      sql`, `,
    )} restart identity cascade`,
  )
  await seed(db)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertLocalDatabaseUrl(env.DATABASE_URL)
  const db = createDb()
  await resetDatabase(db)
  console.log(`db:reset: ${allTables().length} tables truncated and seeded`)
  // postgres-js keeps the socket open otherwise, so the CLI script never exits.
  await db.$client.end()
}
