import type { Db } from '../../db/client'
import { usersTable } from '../../db/schema'

import type { NewUser, User } from './users.schema'

// null on a duplicate email (case-insensitive, per the `users_lower_email_idx`
// unique index) — same onConflictDoNothing mechanism as db/seed.ts.
export async function createUser(db: Db, input: NewUser): Promise<User | null> {
  const [user] = await db.insert(usersTable).values(input).onConflictDoNothing().returning()
  return user ?? null
}
