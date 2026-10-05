import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../config'
import { k } from '../context'
import { roundsTable, usersTable } from '../db/schema'

import { getEventRanking } from '../modules/ranking/ranking.service'

import { rankingDigest } from './ranking-digest'
import { createRecorder } from './recorder'
import { connectSse, type FetchLike } from './sse-client'

// In-process: app.fetch is the transport, against the suite's own test
// database. Timing rule (#431): nothing here measures a duration — events
// are awaited by polling with a wide deadline.

const db = k.resolve('db')
const inProcess: FetchLike = async (input, init) => app.request(input, init)
const SSE_URL = 'http://localhost/sse'

beforeEach(async () => {
  await db.execute(sql`truncate table ${roundsTable}, ${usersTable} restart identity cascade`)
})

afterAll(async () => {
  await db.$client.end()
})

async function insertUser(role: 'participant' | 'organizer') {
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `load-sse-${crypto.randomUUID()}@edu.pucrs.br`,
      passwordHash: 'hash',
      role,
      university: 'pucrs',
    })
    .returning()
  if (!user) throw new Error('expected a user fixture')
  const token = await signJwt(
    { role, university: 'pucrs' },
    { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
  )
  return { user, token }
}

async function waitFor(check: () => boolean, deadlineMs = 15_000) {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > deadlineMs) throw new Error('waitFor: deadline passed')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

describe('connectSse', { timeout: 30_000 }, () => {
  it('opens, receives state.sync and ranking.updated, and closes as closed — not dropped', async () => {
    const { token } = await insertUser('participant')
    const recorder = createRecorder()

    const connection = await connectSse({
      url: SSE_URL,
      token,
      fetch: inProcess,
      connectTimeoutMs: 10_000,
      recorder,
    })

    expect(connection.report().state).toBe('open')
    await waitFor(() => {
      const { events } = connection.report()
      return events['state.sync'] === 1 && events['ranking.updated'] === 1
    })

    await connection.close()

    const report = connection.report()
    expect(report.state).toBe('closed')
    expect(report.dropReason).toBeNull()
    expect(report.invalidPayloads).toBe(0)
    expect(recorder.snapshot().http.rest?.['GET /sse']?.byStatus).toEqual({ '200': 1 })
  })

  it('measures each event type’s bytes, when it first arrived and the last ranking’s digest (#138)', async () => {
    const { token } = await insertUser('participant')

    const connection = await connectSse({
      url: SSE_URL,
      token,
      fetch: inProcess,
      connectTimeoutMs: 10_000,
    })
    await waitFor(() => connection.report().events['ranking.updated'] === 1)
    await connection.close()

    const report = connection.report()
    expect(report.bytes['state.sync']?.total).toBeGreaterThan(0)
    expect(report.bytes['ranking.updated']?.total).toBeGreaterThan(0)
    expect(report.headersMs).toBeGreaterThanOrEqual(0)
    expect(report.firstEventMs['state.sync']).toBeGreaterThanOrEqual(0)
    expect(report.firstEventMs['ranking.updated']).toBeGreaterThanOrEqual(0)
    expect(report.lastRankingDigest).toBe(
      rankingDigest({ round: null, event: await getEventRanking(db) }),
    )
  })

  it('reports a refused connection as failed with its status and code, without throwing', async () => {
    const connection = await connectSse({
      url: SSE_URL,
      token: 'not-a-jwt',
      fetch: inProcess,
      connectTimeoutMs: 10_000,
    })

    expect(connection.report()).toMatchObject({
      state: 'failed',
      failure: { status: 401, errorCode: 'unauthorized' },
    })
    await expect(connection.close()).resolves.toBeUndefined()
  })

  it('records a deactivation as dropped with session.revoked, without throwing', async () => {
    const { user, token } = await insertUser('participant')
    const organizer = await insertUser('organizer')

    const connection = await connectSse({
      url: SSE_URL,
      token,
      fetch: inProcess,
      connectTimeoutMs: 10_000,
    })
    await waitFor(() => connection.report().events['ranking.updated'] === 1)
    // The handler subscribes to the bus right after writing the snapshot,
    // which can trail the client reading it by a tick (sse.test.ts).
    await new Promise((resolve) => setTimeout(resolve, 0))

    const res = await app.request(`/organizer/users/${user.id}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizer.token}` },
    })
    expect(res.status).toBe(200)
    await connection.ended

    expect(connection.report()).toMatchObject({
      state: 'dropped',
      dropReason: 'session.revoked',
    })
    expect(connection.report().events['session.revoked']).toBe(1)
  })

  it('counts an invalid payload and reports a stream that just ends as stream_ended', async () => {
    const connection = await connectSse({
      url: SSE_URL,
      token: 'x',
      fetch: async () =>
        streamResponse([
          'event: heartbeat\ndata: {"type":"heartbeat","serverTime":"2026-10-05T00:00:00.000Z"}\n\n',
          'event: heartbeat\ndata: {"type":"heartbeat"}\n\n',
          'data: not json\n\n',
        ]),
      connectTimeoutMs: 10_000,
    })
    await connection.ended

    const report = connection.report()
    expect(report.state).toBe('dropped')
    expect(report.dropReason).toBe('stream_ended')
    expect(report.events).toEqual({ heartbeat: 1 })
    expect(report.invalidPayloads).toBe(2)
    expect(report.invalidSamples).toEqual(['{"type":"heartbeat"}', 'not json'])
  })

  it('reports a network error as failed with the error code', async () => {
    const recorder = createRecorder()
    const connection = await connectSse({
      url: SSE_URL,
      token: 'x',
      fetch: async () => {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })
      },
      connectTimeoutMs: 10_000,
      recorder,
    })

    expect(connection.report()).toMatchObject({
      state: 'failed',
      failure: { status: null, reason: 'ECONNREFUSED' },
    })
    expect(recorder.snapshot().http.rest?.['GET /sse']?.networkErrors).toBe(1)
  })
})
