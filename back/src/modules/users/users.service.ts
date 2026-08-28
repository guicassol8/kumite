import { eq, sql } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { usersTable } from '../../db/schema'

import type { NewUser, User } from './users.schema'

// null on a duplicate email (case-insensitive, per the `users_lower_email_idx`
// unique index) — same onConflictDoNothing mechanism as db/seed.ts.
export async function createUser(db: Db, input: NewUser): Promise<User | null> {
  const [user] = await db.insert(usersTable).values(input).onConflictDoNothing().returning()
  return user ?? null
}

// Case-insensitive, mirroring the `users_lower_email_idx` unique index.
export async function findUserByEmail(db: Db, email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${email})`)
  return user ?? null
}

export async function findUserById(db: Db, id: string): Promise<User | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id))
  return user ?? null
}
