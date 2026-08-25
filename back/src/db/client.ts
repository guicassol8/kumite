import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '../config'
import * as schema from './schema'

// postgres-js connects lazily: creating the client opens no socket, so the app
// boots (and unit tests run) without a database available.
export function createDb() {
  const sql = postgres(env.DATABASE_URL)
  return drizzle(sql, { schema })
}

export type Db = ReturnType<typeof createDb>
