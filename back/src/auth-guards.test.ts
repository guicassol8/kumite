import { signJwt } from '@katajs-framework/core/jwt'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app, modules } from './app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from './config'
import { k } from './context'
import { problemsTable, problemTranslationsTable, usersTable } from './db/schema'
import { requirePasswordUpToDate, requireUser } from './middlewares/auth'

// Cross-module HTTP suite (#27): proves the organizer role guard and the
// existing participant auth guard together, over the real routing chain —
// not reachable from any single module's own test file. Lives at src/ root
// per the kata layout doc's "cross-module and process-level test suites".
const db = k.resolve('db')

const NIL_ID = '00000000-0000-0000-0000-000000000000'

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${problemTranslationsTable}, ${problemsTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

async function insertUser(role: 'participant' | 'organizer') {
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `${role}-${crypto.randomUUID()}@example.com`,
      passwordHash: 'hash',
      role,
      university: 'pucrs',
    })
    .returning()
  if (!user) throw new Error('expected user to be inserted')
  return user
}

async function tokenFor(user: {
  id: string
  role: 'participant' | 'organizer'
  university: 'pucrs' | 'merida'
}) {
  return signJwt(
    { role: user.role, university: user.university },
    { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
  )
}

type Call = { method: string; path: string; body?: unknown }

const organizerRoutes: Call[] = [
  { method: 'POST', path: '/organizer/problems', body: { difficulty: 'easy' } },
  { method: 'GET', path: '/organizer/problems' },
  { method: 'GET', path: `/organizer/problems/${NIL_ID}` },
  { method: 'PATCH', path: `/organizer/problems/${NIL_ID}`, body: {} },
  { method: 'POST', path: `/organizer/problems/${NIL_ID}/publish` },
  { method: 'POST', path: `/organizer/problems/${NIL_ID}/archive` },
]

function request(call: Call, token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (call.body !== undefined) headers['Content-Type'] = 'application/json'
  return app.request(call.path, {
    method: call.method,
    headers,
    body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
  })
}

describe('organizer route guard', () => {
  it.each(organizerRoutes)('$method $path without a token -> 401 unauthorized', async (call) => {
    const res = await request(call)

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'unauthorized' })
  })

  it.each(organizerRoutes)(
    '$method $path with a participant token -> 403 forbidden',
    async (call) => {
      const participant = await insertUser('participant')
      const token = await tokenFor(participant)

      const res = await request(call, token)

      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({ error: 'forbidden' })
    },
  )

  it.each(organizerRoutes)(
    '$method $path with an organizer token -> allowed through the guard',
    async (call) => {
      const organizer = await insertUser('organizer')
      const token = await tokenFor(organizer)

      const res = await request(call, token)

      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    },
  )
})

describe('participant route guard (regression)', () => {
  const participantRoutes: Call[] = [
    { method: 'GET', path: `/problems/${NIL_ID}` },
    { method: 'POST', path: '/submissions', body: {} },
    { method: 'GET', path: '/me' },
    { method: 'GET', path: '/teams' },
  ]

  it.each(participantRoutes)('$method $path without a token -> 401 unauthorized', async (call) => {
    const res = await request(call)

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'unauthorized' })
  })
})

// --- Forced password change (#143) ---

// `requirePasswordUpToDate` is wired per route rather than folded into
// `requireUser` (ADR-0004 explains why: it is the API kata gives for
// authorization, and `kata verify --strict-coverage` can follow the chain).
// The cost of that choice is that it fails *open* — a new authenticated route
// that forgets the middleware is simply unguarded, and nothing complains. This
// test is the payment: it walks every registered route and names the ones that
// drifted, so the convention cannot quietly rot.
//
// Only these two routes may skip it, both because the blocked state would
// otherwise be inescapable: `GET /me` is how the front learns the flag is set,
// and `POST /auth/change-password` is the way out. Adding to this list is a
// deliberate act — anything here is reachable while an account is on a
// temporary password an organizer dictated out loud.
const PASSWORD_CHANGE_EXEMPT = new Set(['GET /me', 'POST /auth/change-password'])

type KataRoute = { method: string; path: string; use?: readonly unknown[] }

function registeredRoutes(): KataRoute[] {
  return modules.flatMap((module) =>
    Object.values(module as Record<string, unknown>).filter(
      (value): value is KataRoute =>
        typeof value === 'object' &&
        value !== null &&
        (value as { __kata?: string }).__kata === 'route',
    ),
  )
}

describe('forced password change guard', () => {
  it('is wired on every authenticated route except the documented escape hatches', () => {
    const offenders = registeredRoutes()
      .filter((route) => route.use?.includes(requireUser))
      .filter((route) => !route.use?.includes(requirePasswordUpToDate))
      .map((route) => `${route.method} ${route.path}`)
      .filter((key) => !PASSWORD_CHANGE_EXEMPT.has(key))

    // Not `toHaveLength(0)`: the diff has to name the route someone forgot,
    // or the failure message sends the next person hunting through 40 routes.
    expect(offenders).toEqual([])
  })

  it('never leaves the exemptions unreachable — both are real, registered routes', () => {
    const registered = new Set(registeredRoutes().map((route) => `${route.method} ${route.path}`))

    for (const key of PASSWORD_CHANGE_EXEMPT) {
      expect(registered).toContain(key)
    }
  })

  it('answers 403 password_change_required on a guarded route, 200 on the escape hatches', async () => {
    const participant = await insertUser('participant')
    await db
      .update(usersTable)
      .set({ mustChangePassword: true })
      .where(eq(usersTable.id, participant.id))
    const token = await tokenFor(participant)

    const blocked = await request({ method: 'GET', path: '/teams' }, token)
    expect(blocked.status).toBe(403)
    expect(await blocked.json()).toMatchObject({ error: 'password_change_required' })

    const me = await request({ method: 'GET', path: '/me' }, token)
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({ mustChangePassword: true })
  })

  it('lets the same account through once the flag is down', async () => {
    const participant = await insertUser('participant')
    const token = await tokenFor(participant)

    const res = await request({ method: 'GET', path: '/teams' }, token)
    expect(res.status).toBe(200)
  })
})

// --- Deactivated account (#174) ---

// Deactivating a user is the only moderation lever during the event, and until
// #174 it did nothing to sessions already issued: the JWT stayed good for its
// whole ~24h TTL, so a banned participant kept browsing, submitting and
// scoring. Only a *new* login was refused. These tests are that bug, frozen.
describe('deactivated account guard', () => {
  const deactivatedRoutes: Call[] = [
    { method: 'GET', path: '/me' },
    { method: 'GET', path: '/teams' },
    { method: 'POST', path: '/submissions', body: {} },
  ]

  it.each(deactivatedRoutes)(
    '$method $path with a token issued before the ban -> 401 unauthorized',
    async (call) => {
      const participant = await insertUser('participant')
      // Issued while the account was still active — the tab the participant
      // left open before the organizer hit Deactivate.
      const token = await tokenFor(participant)
      await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, participant.id))

      const res = await request(call, token)

      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({ error: 'unauthorized' })
    },
  )
})
