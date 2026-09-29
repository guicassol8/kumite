import { join } from 'node:path'

import { assertLocalDatabaseUrl } from './local-database'
import { ensureDatabase, readDotenv, resolveDatabaseUrl } from './test-database'

// db:create (#392): creates the database DATABASE_URL names when it does not
// exist yet, so a worktree can give its E2E/hurl run a database of its own on
// a shared native Postgres — no Docker, no createdb/psql binaries needed. Then
// db:migrate + db:seed (or db:reset) fill it. Local databases only, like
// db:reset. Free of config.ts on purpose: creating a database needs no
// JWT_SECRET. The URL is never logged — it carries the password.

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = resolveDatabaseUrl(process.env, readDotenv(join(import.meta.dirname, '..', '..')))
  assertLocalDatabaseUrl(url, 'db:create')
  const name = decodeURIComponent(new URL(url).pathname.slice(1))
  const outcome = await ensureDatabase(url)
  console.log(
    outcome === 'created'
      ? `db:create: database "${name}" created`
      : `db:create: database "${name}" already existed — nothing to do`,
  )
}
