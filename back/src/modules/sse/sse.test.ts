import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
import { createDb } from '../../db/client'
import { roundsTable, usersTable } from '../../db/schema'
import type { SseEvent } from './sse.schema'
import {
  HeartbeatEventSchema,
  RankingUpdatedEventSchema,
  RoundClosedEventSchema,
  RoundExtendedEventSchema,
  RoundOpenedEventSchema,
  SseEventSchema,
  StateSyncEventSchema,
} from './sse.schema'
import {
  buildStateSyncEvent,
  createSseBus,
  publishRoundClosed,
  publishRoundExtended,
  publishRoundOpened,
  runExpiryTick,
} from './sse.service'

describe('sse.schema', () => {
  it('round-trips a state.sync event with an open round', () => {
    const event = {
      type: 'state.sync' as const,
      serverTime: new Date(),
      round: { id: 'r1', closesAt: new Date() },
    }
    expect(StateSyncEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('round-trips a state.sync event with no open round', () => {
    const event = { type: 'state.sync' as const, serverTime: new Date(), round: null }
    expect(StateSyncEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('round-trips a round.opened event', () => {
    const event = {
      type: 'round.opened' as const,
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date(),
    }
    expect(RoundOpenedEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('round-trips a round.extended event', () => {
    const event = {
      type: 'round.extended' as const,
      serverTime: new Date(),
      roundId: 'r1',
      closesAt: new Date(),
    }
    expect(RoundExtendedEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('round-trips a round.closed event', () => {
    const event = { type: 'round.closed' as const, serverTime: new Date(), roundId: 'r1' }
    expect(RoundClosedEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('round-trips a heartbeat event', () => {
    const event = { type: 'heartbeat' as const, serverTime: new Date() }
    expect(HeartbeatEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('rejects an unknown event type', () => {
    const event = { type: 'unknown', serverTime: new Date() }
    expect(SseEventSchema.safeParse(event).success).toBe(false)
  })

  const eventRankingFixture = {
    teams: [
      {
        teamId: 't1',
        teamName: 'Team 1',
        rank: 1,
        totalScore: 100,
        totalAttempts: 3,
        tiebreakTimeMs: 5000,
        rounds: [],
      },
    ],
  }

  it('round-trips a ranking.updated event with an open round', () => {
    const event = {
      type: 'ranking.updated' as const,
      serverTime: new Date(),
      round: {
        roundId: 'r1',
        roundName: 'Round 1',
        problemIds: ['p1'],
        teams: [
          {
            teamId: 't1',
            teamName: 'Team 1',
            rank: 1,
            totalScore: 100,
            totalAttempts: 3,
            tiebreakTimeMs: 5000,
            problems: [{ problemId: 'p1', score: 100, attempts: 3 }],
          },
        ],
      },
      event: eventRankingFixture,
    }
    expect(RankingUpdatedEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('round-trips a ranking.updated event with no open round', () => {
    const event = {
      type: 'ranking.updated' as const,
      serverTime: new Date(),
      round: null,
      event: eventRankingFixture,
    }
    expect(RankingUpdatedEventSchema.safeParse(event).success).toBe(true)
    expect(SseEventSchema.safeParse(event).success).toBe(true)
  })

  it('rejects a ranking.updated event missing the event ranking', () => {
    const event = { type: 'ranking.updated' as const, serverTime: new Date(), round: null }
    expect(RankingUpdatedEventSchema.safeParse(event).success).toBe(false)
  })
})

describe('sse.service', () => {
  describe('createSseBus', () => {
    it('fans out a published event to every subscriber', () => {
      const bus = createSseBus()
      const a = vi.fn()
      const b = vi.fn()
      bus.subscribe(a)
      bus.subscribe(b)

      const event: SseEvent = { type: 'heartbeat', serverTime: new Date() }
      bus.publish(event)

      expect(a).toHaveBeenCalledWith(event)
      expect(b).toHaveBeenCalledWith(event)
    })

    it('stops notifying a subscriber once unsubscribed', () => {
      const bus = createSseBus()
      const fn = vi.fn()
      const unsubscribe = bus.subscribe(fn)
      unsubscribe()

      bus.publish({ type: 'heartbeat', serverTime: new Date() })

      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('publish helpers', () => {
    it('shapes round.opened / round.extended / round.closed events', () => {
      const bus = createSseBus()
      const fn = vi.fn()
      bus.subscribe(fn)
      const closesAt = new Date()

      publishRoundOpened(bus, { id: 'r1', closesAt })
      publishRoundExtended(bus, { id: 'r1', closesAt })
      publishRoundClosed(bus, { id: 'r1' })

      expect(fn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: 'round.opened', roundId: 'r1', closesAt }),
      )
      expect(fn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: 'round.extended', roundId: 'r1', closesAt }),
      )
      expect(fn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ type: 'round.closed', roundId: 'r1' }),
      )
    })
  })

  describe('against a real db', () => {
    const db = createDb()

    beforeEach(async () => {
      await db.execute(sql`truncate table ${roundsTable} restart identity cascade`)
    })

    afterAll(async () => {
      await db.$client.end()
    })

    describe('buildStateSyncEvent', () => {
      it('carries the open round when there is one', async () => {
        const closesAt = new Date(Date.now() + 60_000)
        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(),
            closesAt,
          })
          .returning()
        if (!round) throw new Error('expected fixture')

        const event = await buildStateSyncEvent(db)

        expect(event.type).toBe('state.sync')
        expect(event.round).toEqual({ id: round.id, closesAt })
      })

      it('carries a null round when nothing is open', async () => {
        const event = await buildStateSyncEvent(db)
        expect(event.round).toBeNull()
      })
    })

    describe('runExpiryTick', () => {
      it('closes an overdue open round, publishing one round.closed and one heartbeat', async () => {
        const closesAt = new Date(Date.now() - 60_000)
        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(Date.now() - 120_000),
            closesAt,
          })
          .returning()
        if (!round) throw new Error('expected fixture')
        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)

        await runExpiryTick(db, bus)

        expect(fn).toHaveBeenCalledTimes(2)
        expect(fn).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ type: 'round.closed', roundId: round.id }),
        )
        expect(fn).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'heartbeat' }))
      })

      it('publishes only a heartbeat when nothing expired', async () => {
        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)

        await runExpiryTick(db, bus)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'heartbeat' }))
      })

      it('does not throw when the db rejects', async () => {
        const bus = createSseBus()
        const failingDb = {
          ...db,
          update: () => {
            throw new Error('db is down')
          },
        } as unknown as typeof db

        await expect(runExpiryTick(failingDb, bus)).resolves.toBeUndefined()
      })
    })
  })
})

// Reads one `\n\n`-terminated SSE frame at a time off the response body,
// buffering across chunk boundaries.
function createFrameReader(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    async next(): Promise<string> {
      while (!buffer.includes('\n\n')) {
        const { value, done } = await reader.read()
        if (done) throw new Error('stream closed before a full SSE frame arrived')
        buffer += decoder.decode(value, { stream: true })
      }
      const index = buffer.indexOf('\n\n')
      const frame = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      return frame
    },
    cancel: () => reader.cancel(),
  }
}

describe('GET /sse', () => {
  const db = k.resolve('db')

  beforeEach(async () => {
    await db.execute(sql`truncate table ${roundsTable}, ${usersTable} restart identity cascade`)
  })

  afterAll(async () => {
    await db.$client.end()
  })

  async function tokenFor(user: { id: string; role: 'participant' | 'organizer' }) {
    return signJwt(
      { role: user.role, university: 'pucrs' },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  it('refuses the connection without a token', async () => {
    const res = await app.request('/sse')
    expect(res.status).toBe(401)
  })

  it('sends the current state.sync first, then forwards a published event', async () => {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: `sse-${crypto.randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'participant',
        university: 'pucrs',
      })
      .returning()
    if (!user) throw new Error('expected fixture')
    const closesAt = new Date(Date.now() + 60_000)
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Round 1', durationMinutes: 30, status: 'open', closesAt })
      .returning()
    if (!round) throw new Error('expected fixture')
    const token = await tokenFor(user)

    const res = await app.request('/sse', { headers: { Authorization: `Bearer ${token}` } })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    if (!res.body) throw new Error('expected a streamed body')
    const frames = createFrameReader(res.body)

    const first = await frames.next()
    expect(first).toContain('event: state.sync')
    expect(JSON.parse(first.split('data: ')[1] ?? '')).toMatchObject({
      round: { id: round.id },
    })

    // The handler's own continuation (subscribing to the bus) runs after
    // `writeSSE`'s promise resolves, which can trail the client having
    // already read that same chunk by a tick or two — give it one before
    // publishing, or the event below has no subscriber yet to catch it.
    await new Promise((resolve) => setTimeout(resolve, 0))
    k.resolve('sseBus').publish({ type: 'heartbeat', serverTime: new Date() })

    const second = await frames.next()
    expect(second).toContain('event: heartbeat')

    await frames.cancel()
  })
})
