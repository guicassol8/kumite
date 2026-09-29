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

// This script wipes every table: it refuses anything that is not plainly a
// local database. The guard lives in a config-free module since #392, shared
// with db:create and the test suite's globalSetup.
import { assertLocalDatabaseUrl } from './local-database'

export { assertLocalDatabaseUrl }

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
