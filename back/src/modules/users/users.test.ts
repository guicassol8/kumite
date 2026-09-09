import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import { teamMembersTable, teamsTable, usersTable } from '../../db/schema'
import type { NewUser } from './users.schema'
import { ListUsersQuerySchema, UserClaimsSchema } from './users.schema'
import {
  createUser,
  deactivateUser,
  demoteUser,
  findUserByEmail,
  findUserById,
  listUsers,
  promoteUser,
  reactivateUser,
} from './users.service'

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
  await db.execute(
    sql`truncate table ${teamMembersTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
  )
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

describe('ListUsersQuerySchema', () => {
  it('fills in limit=20 and offset=0 when omitted', () => {
    expect(ListUsersQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 })
  })

  it('coerces limit and offset from query-string values', () => {
    expect(ListUsersQuerySchema.parse({ limit: '5', offset: '10' })).toEqual({
      limit: 5,
      offset: 10,
    })
  })

  it('rejects a limit above 100', () => {
    const result = ListUsersQuerySchema.safeParse({ limit: '101' })
    expect(result.success).toBe(false)
  })

  it('accepts optional filters', () => {
    const teamId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    const result = ListUsersQuerySchema.parse({
      q: 'ada',
      role: 'organizer',
      university: 'pucrs',
      teamId,
    })
    expect(result).toMatchObject({
      q: 'ada',
      role: 'organizer',
      university: 'pucrs',
      teamId,
    })
  })

  it('rejects a teamId that is not a uuid (#94)', () => {
    // The column is a Postgres uuid: a malformed filter used to reach the
    // driver and come back as a 500 instead of the route's 422.
    expect(ListUsersQuerySchema.safeParse({ teamId: 'team-1' }).success).toBe(false)
    expect(ListUsersQuerySchema.safeParse({ teamId: '' }).success).toBe(false)
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

describe('users.service findUserByEmail', () => {
  it('finds a created user by email regardless of case', async () => {
    await createUser(db, baseUser)
    const found = await findUserByEmail(db, 'Ada@Example.com')
    expect(found?.email).toBe(baseUser.email)
  })

  it('returns null when no user matches', async () => {
    const found = await findUserByEmail(db, 'nobody@example.com')
    expect(found).toBeNull()
  })
})

describe('users.service findUserById', () => {
  it('finds a created user by id', async () => {
    const created = await createUser(db, baseUser)
    if (!created) throw new Error('expected user')
    const found = await findUserById(db, created.id)
    expect(found?.email).toBe(baseUser.email)
  })

  it('returns null when no user matches', async () => {
    const found = await findUserById(db, '00000000-0000-0000-0000-000000000000')
    expect(found).toBeNull()
  })
})

describe('users.service listUsers', () => {
  it('finds a user by an email fragment, case-insensitively', async () => {
    await createUser(db, baseUser)
    await createUser(db, { ...baseUser, email: 'grace@example.com' })

    const result = await listUsers(db, { q: 'ADA', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email)).toEqual(['ada@example.com'])
    expect(result.total).toBe(1)
  })

  it('filters by role and university', async () => {
    await createUser(db, baseUser)
    await createUser(db, { ...baseUser, email: 'org@example.com', role: 'organizer' })
    await createUser(db, { ...baseUser, email: 'merida@example.com', university: 'merida' })

    const organizers = await listUsers(db, { role: 'organizer', limit: 20, offset: 0 })
    expect(organizers.items.map((u) => u.email)).toEqual(['org@example.com'])

    const merida = await listUsers(db, { university: 'merida', limit: 20, offset: 0 })
    expect(merida.items.map((u) => u.email)).toEqual(['merida@example.com'])
  })

  it('filters by teamId and includes the team ref', async () => {
    const user = await createUser(db, baseUser)
    if (!user) throw new Error('expected user')
    const [team] = await db.insert(teamsTable).values({ name: 'Team Ada' }).returning()
    if (!team) throw new Error('expected team')
    await db.insert(teamMembersTable).values({ userId: user.id, teamId: team.id })

    const result = await listUsers(db, { teamId: team.id, limit: 20, offset: 0 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.team).toEqual({ id: team.id, name: 'Team Ada' })
  })

  it('paginates with limit/offset and reports total across all pages', async () => {
    for (let i = 0; i < 5; i++) {
      await createUser(db, { ...baseUser, email: `user${i}@example.com` })
    }

    const page = await listUsers(db, { limit: 2, offset: 2 })
    expect(page.items).toHaveLength(2)
    expect(page.total).toBe(5)
  })
})

describe('users.service promoteUser / demoteUser', () => {
  it('promotes a participant to organizer', async () => {
    const user = await createUser(db, baseUser)
    if (!user) throw new Error('expected user')

    const result = await promoteUser(db, user.id)
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ role: 'organizer' }) })
  })

  it('promote is idempotent — already organizer succeeds', async () => {
    const user = await createUser(db, { ...baseUser, role: 'organizer' })
    if (!user) throw new Error('expected user')

    const result = await promoteUser(db, user.id)
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ role: 'organizer' }) })
  })

  it('promote 404s on an unknown id', async () => {
    const result = await promoteUser(db, '00000000-0000-0000-0000-000000000000')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('demotes an organizer to participant', async () => {
    const acting = await createUser(db, {
      ...baseUser,
      email: 'org@example.com',
      role: 'organizer',
    })
    const target = await createUser(db, { ...baseUser, role: 'organizer' })
    if (!acting || !target) throw new Error('expected users')

    const result = await demoteUser(db, acting.id, target.id)
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ role: 'participant' }) })
  })

  it('rejects demoting yourself', async () => {
    const user = await createUser(db, { ...baseUser, role: 'organizer' })
    if (!user) throw new Error('expected user')

    const result = await demoteUser(db, user.id, user.id)
    expect(result).toEqual({ ok: false, error: 'cannot_demote_self' })
  })

  it('demote 404s on an unknown id', async () => {
    const acting = await createUser(db, { ...baseUser, role: 'organizer' })
    if (!acting) throw new Error('expected user')

    const result = await demoteUser(db, acting.id, '00000000-0000-0000-0000-000000000000')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('users.service deactivateUser / reactivateUser', () => {
  it('deactivates a user', async () => {
    const acting = await createUser(db, {
      ...baseUser,
      email: 'org@example.com',
      role: 'organizer',
    })
    const target = await createUser(db, baseUser)
    if (!acting || !target) throw new Error('expected users')

    const result = await deactivateUser(db, acting.id, target.id)
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ active: false }) })
  })

  it('rejects deactivating yourself', async () => {
    const user = await createUser(db, { ...baseUser, role: 'organizer' })
    if (!user) throw new Error('expected user')

    const result = await deactivateUser(db, user.id, user.id)
    expect(result).toEqual({ ok: false, error: 'cannot_deactivate_self' })
  })

  it('deactivate 404s on an unknown id', async () => {
    const acting = await createUser(db, { ...baseUser, role: 'organizer' })
    if (!acting) throw new Error('expected user')

    const result = await deactivateUser(db, acting.id, '00000000-0000-0000-0000-000000000000')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('reactivates a deactivated user', async () => {
    const acting = await createUser(db, {
      ...baseUser,
      email: 'org@example.com',
      role: 'organizer',
    })
    const target = await createUser(db, baseUser)
    if (!acting || !target) throw new Error('expected users')
    await deactivateUser(db, acting.id, target.id)

    const result = await reactivateUser(db, target.id)
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ active: true }) })
  })

  it('reactivate is idempotent — already active succeeds', async () => {
    const user = await createUser(db, baseUser)
    if (!user) throw new Error('expected user')

    const result = await reactivateUser(db, user.id)
    expect(result).toEqual({ ok: true, user: expect.objectContaining({ active: true }) })
  })

  it('reactivate 404s on an unknown id', async () => {
    const result = await reactivateUser(db, '00000000-0000-0000-0000-000000000000')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})
