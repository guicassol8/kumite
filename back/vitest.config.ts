import { defineConfig } from 'vitest/config'

import { resolveTestDatabaseUrlFor } from './src/db/test-database'

// Several test files (db/seed.test.ts, users.test.ts, event-codes.test.ts,
// auth.test.ts) run against the same live Postgres and truncate shared
// tables in beforeEach. Vitest's default parallel-file execution races those
// truncates against each other, so files run sequentially instead.
//
// Those truncates also used to hit whatever DATABASE_URL pointed at — the
// same database a Playwright run, the hurl suite or a dev server was using,
// whose seed vanished mid-run whenever the Stop hook ran the ladder (#392).
// The suite now gets its own database, derived from DATABASE_URL (or
// TEST_DATABASE_URL, which wins): `<db>_test` in the main checkout and CI,
// `<db>_test_<worktree>` in a linked worktree. The globalSetup creates and
// migrates it; `env` points every worker at it. See src/db/test-database.ts.
export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['./src/db/test-global-setup.ts'],
    env: { DATABASE_URL: resolveTestDatabaseUrlFor(import.meta.dirname) },
    // Strips the SES credentials from process.env before anything imports
    // config.ts — see the file's own comment.
    setupFiles: ['./vitest.setup.ts'],
  },
})
