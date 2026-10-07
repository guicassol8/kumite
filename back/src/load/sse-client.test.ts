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
import { connectSse, createPayloadCache, type FetchLike } from './sse-client'

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

// --- #442: one validation per distinct payload ---

const rankingFrame = (score: number) =>
  JSON.stringify({
    type: 'ranking.updated',
    serverTime: '2026-10-05T00:00:01.000Z',
    round: {
      roundId: 'r1',
      roundName: 'load-x',
      problemIds: ['p1'],
      denominators: 'consistent',
      teams: [
        {
          teamId: 't1',
          teamName: 'Time 1',
          rank: 1,
          totalScore: score,
          totalAttempts: 1,
          tiebreakTimeMs: 10,
          problems: [{ problemId: 'p1', score, attempts: 1, maxScore: 100 }],
        },
      ],
    },
    event: { rounds: [], teams: [] },
  })
const HEARTBEAT = '{"type":"heartbeat","serverTime":"2026-10-05T00:00:00.000Z"}'

const sse = (data: string, event = 'message') => `event: ${event}\ndata: ${data}\n\n`

describe('createPayloadCache', () => {
  it('validates a payload once and serves the same answer to every later reader', () => {
    const cache = createPayloadCache()
    const first = cache.classify(HEARTBEAT)
    expect(first).toEqual({
      ok: true,
      type: 'heartbeat',
      rankingDigest: null,
      bytes: Buffer.byteLength(HEARTBEAT),
    })
    expect(cache.classify(HEARTBEAT)).toEqual(first)
    expect(cache.classify('not json')).toEqual({ ok: false })
    expect(cache.classify('not json')).toEqual({ ok: false })
    expect(cache.stats()).toEqual({ distinct: 2, reused: 2 })
  })

  it('keeps at most maxEntries: the oldest is dropped and validated again when it returns', () => {
    const cache = createPayloadCache({ maxEntries: 2 })
    cache.classify('"a"')
    cache.classify('"b"')
    cache.classify('"c"')
    expect(cache.stats()).toEqual({ distinct: 3, reused: 0 })
    cache.classify('"c"')
    cache.classify('"a"')
    expect(cache.stats()).toEqual({ distinct: 4, reused: 1 })
  })
})

describe('connectSse with a shared payload cache (#442)', () => {
  it('validates each distinct payload once and still counts per connection', async () => {
    const payloads = createPayloadCache()
    const frames = [
      sse(HEARTBEAT, 'heartbeat'),
      sse(rankingFrame(100), 'ranking.updated'),
      'data: not json\n\n',
    ]
    const open = () =>
      connectSse({
        url: SSE_URL,
        token: 'x',
        fetch: async () => streamResponse(frames),
        connectTimeoutMs: 10_000,
        payloads,
      })
    const [a, b] = await Promise.all([open(), open()])
    await Promise.all([a.ended, b.ended])

    const expected = rankingDigest(JSON.parse(rankingFrame(100)))
    for (const connection of [a, b]) {
      const report = connection.report()
      expect(report.invalidPayloads).toBe(1)
      expect(report.invalidSamples).toEqual(['not json'])
      expect(report.events).toEqual({ heartbeat: 1, 'ranking.updated': 1 })
      expect(report.bytes['ranking.updated']?.total).toBe(Buffer.byteLength(rankingFrame(100)))
      expect(report.lastRankingDigest).toBe(expected)
    }
    expect(payloads.stats()).toEqual({ distinct: 3, reused: 3 })
  })

  it('keeps the digest of the last ranking, never a cached older one', async () => {
    const payloads = createPayloadCache()
    const open = (scores: number[]) =>
      connectSse({
        url: SSE_URL,
        token: 'x',
        fetch: async () =>
          streamResponse(scores.map((score) => sse(rankingFrame(score), 'ranking.updated'))),
        connectTimeoutMs: 10_000,
        payloads,
      })
    const first = await open([100, 200])
    await first.ended
    const second = await open([200, 100])
    await second.ended

    expect(first.report().lastRankingDigest).toBe(rankingDigest(JSON.parse(rankingFrame(200))))
    expect(second.report().lastRankingDigest).toBe(rankingDigest(JSON.parse(rankingFrame(100))))
    expect(payloads.stats()).toEqual({ distinct: 2, reused: 2 })
  })
})
