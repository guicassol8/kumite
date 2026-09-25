import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
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
  name: 'Ada Lovelace',
  passwordHash: 'hash',
  role: 'participant',
  university: 'pucrs',
}

// An account created before the #122 migration: the column is nullable, so
// every read path has to survive it.
const legacyUser: NewUser = { ...baseUser, email: 'legacy@example.com', name: null }

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
    // A name of its own, or 'ADA' would match this row through the name side
    // too and the case would stop being about email search.
    await createUser(db, { ...baseUser, email: 'grace@example.com', name: 'Grace Hopper' })

    const result = await listUsers(db, { q: 'ADA', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email)).toEqual(['ada@example.com'])
    expect(result.total).toBe(1)
  })

  it('finds a user by a name fragment, case-insensitively (#122)', async () => {
    await createUser(db, baseUser)
    await createUser(db, { ...baseUser, email: 'grace@example.com', name: 'Grace Hopper' })

    const result = await listUsers(db, { q: 'LOVELACE', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email)).toEqual(['ada@example.com'])
    expect(result.total).toBe(1)
    expect(result.items[0]?.name).toBe('Ada Lovelace')
  })

  it('matches a fragment of either side, name or email', async () => {
    await createUser(db, { ...baseUser, email: 'zzz@example.com', name: 'Grace Hopper' })
    await createUser(db, { ...baseUser, email: 'grace@example.com', name: 'Ada Lovelace' })

    // 'grace' is one row's name and the other row's email — both come back.
    const result = await listUsers(db, { q: 'grace', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email).sort()).toEqual([
      'grace@example.com',
      'zzz@example.com',
    ])
    expect(result.total).toBe(2)
  })

  it('does not break on a user whose name is null, and never matches it by name', async () => {
    await createUser(db, legacyUser)
    await createUser(db, baseUser)

    const byName = await listUsers(db, { q: 'lovelace', limit: 20, offset: 0 })
    expect(byName.items.map((u) => u.email)).toEqual(['ada@example.com'])

    const byEmail = await listUsers(db, { q: 'legacy', limit: 20, offset: 0 })
    expect(byEmail.items.map((u) => u.email)).toEqual(['legacy@example.com'])
    expect(byEmail.items[0]?.name).toBeNull()
  })

  // The name/email match is one OR'd group: it must not loosen the AND that
  // joins it to the other filters.
  it('keeps q AND role/university, not OR', async () => {
    await createUser(db, baseUser)
    await createUser(db, { ...baseUser, email: 'org@example.com', role: 'organizer' })

    const result = await listUsers(db, { q: 'lovelace', role: 'organizer', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email)).toEqual(['org@example.com'])
    expect(result.total).toBe(1)

    const none = await listUsers(db, { q: 'lovelace', university: 'merida', limit: 20, offset: 0 })
    expect(none.items).toEqual([])
    expect(none.total).toBe(0)
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

  // #282: the search term is literal text — LIKE wildcards and the escape
  // character in it must not act as operators.
  it('treats _ as a literal underscore, on either side (#282)', async () => {
    await createUser(db, { ...baseUser, email: 'ana_lima@example.com', name: 'Ana Lima' })
    await createUser(db, { ...baseUser, email: 'mariana@example.com', name: 'Mariana' })
    await createUser(db, { ...baseUser, email: 'x@example.com', name: 'Ana_B' })

    const result = await listUsers(db, { q: '_', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email).sort()).toEqual([
      'ana_lima@example.com',
      'x@example.com',
    ])
    expect(result.total).toBe(2)
  })

  it('treats % as a literal percent sign (#282)', async () => {
    await createUser(db, { ...baseUser, email: 'promo@example.com', name: 'Promo 100%' })
    await createUser(db, { ...baseUser, email: 'other@example.com', name: 'Promo 1000' })

    const percent = await listUsers(db, { q: '%', limit: 20, offset: 0 })
    expect(percent.items.map((u) => u.email)).toEqual(['promo@example.com'])
    expect(percent.total).toBe(1)

    const hundred = await listUsers(db, { q: '100%', limit: 20, offset: 0 })
    expect(hundred.items.map((u) => u.email)).toEqual(['promo@example.com'])
    expect(hundred.total).toBe(1)
  })

  it('treats a backslash as a literal character, not an escape (#282)', async () => {
    await createUser(db, baseUser)

    const none = await listUsers(db, { q: '\\', limit: 20, offset: 0 })
    expect(none.items).toEqual([])
    expect(none.total).toBe(0)

    await createUser(db, { ...baseUser, email: 'slash@example.com', name: 'a\\b' })
    const found = await listUsers(db, { q: '\\', limit: 20, offset: 0 })
    expect(found.items.map((u) => u.email)).toEqual(['slash@example.com'])
    expect(found.total).toBe(1)
  })

  it('still matches a plain term case-insensitively on name or email (#282)', async () => {
    await createUser(db, { ...baseUser, email: 'a1@example.com', name: 'Ana' })
    await createUser(db, { ...baseUser, email: 'mariana@example.com', name: 'Maria' })
    await createUser(db, { ...baseUser, email: 'a3@example.com', name: 'ANA' })
    await createUser(db, { ...baseUser, email: 'bob@example.com', name: 'Bob' })

    const result = await listUsers(db, { q: 'ana', limit: 20, offset: 0 })
    expect(result.items.map((u) => u.email).sort()).toEqual([
      'a1@example.com',
      'a3@example.com',
      'mariana@example.com',
    ])
    expect(result.total).toBe(3)
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

// #274: the route, not the service, publishes on the bus — services here stay
// pure (AGENTS.md) and injecting the bus into `deactivateUser` would close the
// import cycle users.service -> sse.service -> users.service. Same shape as
// rounds.route.ts publishing round.opened/extended/closed.
describe('POST /organizer/users/:id/deactivate — sse side effect', () => {
  async function organizerSession() {
    const organizer = await createUser(db, {
      ...baseUser,
      email: `organizer-${crypto.randomUUID()}@example.com`,
      role: 'organizer',
    })
    if (!organizer) throw new Error('expected fixture')
    return {
      organizer,
      token: await signJwt(
        { role: organizer.role, university: organizer.university },
        { secret: JWT_SECRET, subject: organizer.id, expiresInSeconds: TOKEN_TTL_SECONDS },
      ),
    }
  }

  it('publishes exactly one user.deactivated carrying the target id', async () => {
    const { token } = await organizerSession()
    const target = await createUser(db, {
      ...baseUser,
      email: `target-${crypto.randomUUID()}@example.com`,
    })
    if (!target) throw new Error('expected fixture')
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await app.request(`/organizer/users/${target.id}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ type: 'user.deactivated', userId: target.id })

    unsubscribe()
  })

  // Nothing was deactivated, so nothing may be closed: publishing on the
  // refused self-deactivation would drop the organizer's own live stream on a
  // request that changed no row.
  it('publishes nothing when the self-guard refuses the deactivation', async () => {
    const { organizer, token } = await organizerSession()
    const fn = vi.fn()
    const unsubscribe = k.resolve('sseBus').subscribe(fn)

    const res = await app.request(`/organizer/users/${organizer.id}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(403)
    expect(fn).not.toHaveBeenCalled()

    unsubscribe()
  })
})
