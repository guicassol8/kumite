import { defineConfig } from 'vitest/config'

// Several test files (db/seed.test.ts, users.test.ts, event-codes.test.ts,
// auth.test.ts) run against the same live Postgres and truncate shared
// tables in beforeEach. Vitest's default parallel-file execution races those
// truncates against each other, so files run sequentially instead.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
