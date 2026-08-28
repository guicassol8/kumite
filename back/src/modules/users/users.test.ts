import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { usersTable } from '../../db/schema'
import type { NewUser } from './users.schema'
import { UserClaimsSchema } from './users.schema'
import { createUser } from './users.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #24 migration must already be applied.
const db = createDb()

const baseUser: NewUser = {
  email: 'ada@example.com',
  passwordHash: 'hash',
  role: 'participant',
  university: 'pucrs',
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${usersTable} restart identity cascade`)
})

afterAll(async () => {
  await db.$client.end()
})

describe('UserClaimsSchema', () => {
  it('rejects claims missing sub', () => {
    const result = UserClaimsSchema.safeParse({ role: 'participant', university: 'pucrs' })
    expect(result.success).toBe(false)
  })

  it('accepts a full set of claims', () => {
    const result = UserClaimsSchema.safeParse({
      sub: 'user-1',
      role: 'participant',
      university: 'pucrs',
    })
    expect(result.success).toBe(true)
  })
})

describe('users.service createUser', () => {
  it('creates a user and returns it', async () => {
    const user = await createUser(db, baseUser)
    expect(user?.email).toBe(baseUser.email)
    expect(user?.role).toBe('participant')
    expect(user?.university).toBe('pucrs')
  })

  it('returns null on a duplicate email that only differs by case', async () => {
    await createUser(db, baseUser)
    const duplicate = await createUser(db, { ...baseUser, email: 'Ada@Example.com' })
    expect(duplicate).toBeNull()
  })
})
