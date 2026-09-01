import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from './app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from './config'
import { k } from './context'
import { problemsTable, problemTranslationsTable, usersTable } from './db/schema'

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
