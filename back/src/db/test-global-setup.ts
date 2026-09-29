import { join } from 'node:path'

import { assertLocalDatabaseUrl } from './local-database'
import { ensureDatabase, migrateDatabase, resolveTestDatabaseUrlFor } from './test-database'

// Vitest globalSetup (#392): runs once in the main process, before any worker,
// and gives the suite its own migrated database — see test-database.ts. The URL
// is resolved exactly as vitest.config.ts resolves the workers' DATABASE_URL.
export async function setup(): Promise<void> {
  const url = resolveTestDatabaseUrlFor(join(import.meta.dirname, '..', '..'))
  // The suite truncates every table: never against anything that is not local.
  assertLocalDatabaseUrl(url, 'the back test suite')
  await ensureDatabase(url)
  await migrateDatabase(url)
}
