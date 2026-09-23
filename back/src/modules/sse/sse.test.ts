import { signJwt } from '@katajs-framework/core/jwt'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
import { createDb } from '../../db/client'
import {
  problemsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import { listRounds, resetPendingRoundClosures } from '../rounds/rounds.service'

// #176: the hold on round.closed keys off judging still in flight. The real
// counter is driven by submitSolution (covered in submissions.test.ts); here
// it is steered directly so the announcement rule can be tested on its own.
const judging = vi.hoisted(() => ({ rounds: new Set<string>() }))

vi.mock('../submissions/submissions.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../submissions/submissions.service')>()
  return { ...actual, hasJudgingInFlight: (roundId: string) => judging.rounds.has(roundId) }
})

import type { SseBusEvent, SseEvent } from './sse.schema'
import {
  HeartbeatEventSchema,
  RankingUpdatedEventSchema,
  RoundClosedEventSchema,
  RoundExtendedEventSchema,
  RoundOpenedEventSchema,
  SessionRevokedEventSchema,
  SseEventSchema,
  StateSyncEventSchema,
} from './sse.schema'
import {
  announceClosedRounds,
  buildRankingUpdatedEvent,
  buildStateSyncEvent,
  createSseBus,
  markRankingDirty,
  publishRoundClosed,
  publishRoundExtended,
  publishRoundOpened,
  publishUserDeactivated,
  ROUND_CLOSE_ANNOUNCE_MAX_WAIT_MS,
  runExpiryTick,
  runRankingTick,
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

  // #274: `user.deactivated` rides the same in-process bus but must never
  // reach the wire — it carries one user's id, and every open connection
  // would receive it. Keeping it out of the union is what makes that a type
  // error in the route rather than a leak nobody notices.
  it('rejects the internal user.deactivated control event', () => {
    const event = { type: 'user.deactivated', userId: crypto.randomUUID() }
    expect(SseEventSchema.safeParse(event).success).toBe(false)
  })

  // #291: the one wire event that is per-connection. It carries nothing that
  // identifies anyone — the connection it is written to already knows whose
  // it is.
  it('round-trips a session.revoked event', () => {
    const serverTime = new Date()
    const wire = JSON.parse(JSON.stringify({ type: 'session.revoked', serverTime }))
    const parsed = SseEventSchema.parse(wire)
    expect(parsed).toEqual({ type: 'session.revoked', serverTime })
    expect(SessionRevokedEventSchema.safeParse(wire).success).toBe(true)
    expect(Object.keys(parsed).sort()).toEqual(['serverTime', 'type'])
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
        denominators: 'consistent' as const,
        teams: [
          {
            teamId: 't1',
            teamName: 'Team 1',
            rank: 1,
            totalScore: 100,
            totalAttempts: 3,
            tiebreakTimeMs: 5000,
            problems: [{ problemId: 'p1', score: 100, attempts: 3, maxScore: 100 }],
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

    it('fans out an internal control event to every subscriber', () => {
      const bus = createSseBus()
      const a = vi.fn()
      const b = vi.fn()
      bus.subscribe(a)
      bus.subscribe(b)

      const event: SseBusEvent = { type: 'user.deactivated', userId: 'u1' }
      bus.publish(event)

      expect(a).toHaveBeenCalledWith(event)
      expect(b).toHaveBeenCalledWith(event)
    })

    // #291: `session.revoked` is on the wire but is per-connection — published
    // on the bus it would log out every connected client at once. Pinned in the
    // type rather than at runtime: the bus stays a dumb fan-out.
    it('does not accept session.revoked as a broadcast event', () => {
      const bus = createSseBus()
      const fn = vi.fn()
      bus.subscribe(fn)

      // @ts-expect-error — session.revoked is written per connection by the route, never broadcast
      bus.publish({ type: 'session.revoked', serverTime: new Date() })

      // The runtime still fans out whatever it is handed; the guarantee is the
      // compile error above.
      expect(fn).toHaveBeenCalledTimes(1)
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

    it('shapes the internal user.deactivated event', () => {
      const bus = createSseBus()
      const fn = vi.fn()
      bus.subscribe(fn)

      publishUserDeactivated(bus, 'u1')

      expect(fn).toHaveBeenCalledWith({ type: 'user.deactivated', userId: 'u1' })
    })
  })

  describe('against a real db', () => {
    const db = createDb()

    beforeEach(async () => {
      judging.rounds.clear()
      resetPendingRoundClosures()
      await db.execute(
        sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemsTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
      )
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

      // #176 part 1: reapExpiredRound runs on ~11 read paths. Whichever runs
      // first closes the round, and the tick then found no freshly-closed row
      // — the event was lost. The announcement now comes from the pending set.
      it('still announces a round another read path already reaped', async () => {
        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(Date.now() - 120_000),
            closesAt: new Date(Date.now() - 60_000),
          })
          .returning()
        if (!round) throw new Error('expected fixture')
        // A plain read beats the tick to it and closes the round itself.
        await listRounds(db)

        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)

        await runExpiryTick(db, bus)

        expect(fn).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'round.closed', roundId: round.id }),
        )
      })

      // #176 part 2 (AC4): a submission accepted at the buzzer is still being
      // judged when the round ends. Announcing now would show a leaderboard
      // missing it — the front fetches a closed round's ranking exactly once.
      it('holds round.closed while the round still has judging in flight', async () => {
        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(Date.now() - 120_000),
            closesAt: new Date(Date.now() - 60_000),
          })
          .returning()
        if (!round) throw new Error('expected fixture')
        judging.rounds.add(round.id)

        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)

        await runExpiryTick(db, bus)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'heartbeat' }))

        // Judging drains; the next tick announces it.
        judging.rounds.delete(round.id)
        await runExpiryTick(db, bus)

        expect(fn).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'round.closed', roundId: round.id }),
        )
      })

      it('announces anyway once the wait ceiling passes, even with judging stuck', async () => {
        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(Date.now() - 120_000),
            closesAt: new Date(Date.now() - 60_000),
          })
          .returning()
        if (!round) throw new Error('expected fixture')
        judging.rounds.add(round.id)

        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)

        await runExpiryTick(db, bus)
        expect(fn).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'round.closed', roundId: round.id }),
        )

        // A worker that never returns must not hold the event forever.
        announceClosedRounds(bus, Date.now() + ROUND_CLOSE_ANNOUNCE_MAX_WAIT_MS + 1)

        expect(fn).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'round.closed', roundId: round.id }),
        )
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

    describe('buildRankingUpdatedEvent', () => {
      it('carries the round ranking when a round is open', async () => {
        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(),
            closesAt: new Date(Date.now() + 60_000),
          })
          .returning()
        if (!round) throw new Error('expected fixture')

        const event = await buildRankingUpdatedEvent(db)

        expect(event.type).toBe('ranking.updated')
        expect(event.round?.roundId).toBe(round.id)
        expect(event.event).toEqual({ teams: [] })
      })

      // #184: a team that never submitted must not show up on the round
      // ranking carried over SSE — same rule as the HTTP endpoint, since
      // this just wraps getRoundRanking. The event-wide ranking keeps every
      // active team, which is the assertion that would catch a regression
      // leaking the round filter into the aggregate.
      it('omits a team that never submitted from the round ranking, but not from the event ranking', async () => {
        const [problem] = await db
          .insert(problemsTable)
          .values({ difficulty: 'easy', status: 'published', points: 100 })
          .returning()
        if (!problem) throw new Error('expected fixture')

        const [round] = await db
          .insert(roundsTable)
          .values({
            name: 'Round 1',
            durationMinutes: 30,
            status: 'open',
            openedAt: new Date(),
            closesAt: new Date(Date.now() + 60_000),
          })
          .returning()
        if (!round) throw new Error('expected fixture')
        await db
          .insert(roundProblemsTable)
          .values({ roundId: round.id, problemId: problem.id, position: 0 })

        const [teamA] = await db.insert(teamsTable).values({ name: 'Time A' }).returning()
        const [teamB] = await db.insert(teamsTable).values({ name: 'Time B' }).returning()
        if (!teamA || !teamB) throw new Error('expected fixture')

        const [user] = await db
          .insert(usersTable)
          .values({
            email: 'sse-ranking-fixture@edu.pucrs.br',
            passwordHash: 'hash',
            role: 'participant',
            university: 'pucrs',
          })
          .returning()
        if (!user) throw new Error('expected fixture')

        await db.insert(submissionsTable).values({
          problemId: problem.id,
          roundId: round.id,
          teamId: teamA.id,
          userId: user.id,
          workspace: {},
          generatedCode: '',
          caseResults: [],
          score: 100,
          attemptNumber: 1,
          acceptedAt: new Date(),
        })

        const event = await buildRankingUpdatedEvent(db)

        expect(event.round?.teams.map((team) => team.teamName)).toEqual(['Time A'])
        expect(event.event.teams.map((team) => team.teamName).sort()).toEqual(['Time A', 'Time B'])
      })

      it('carries a null round and a populated event ranking when nothing is open', async () => {
        const event = await buildRankingUpdatedEvent(db)

        expect(event.round).toBeNull()
        expect(event.event).toEqual({ teams: [] })
      })
    })

    describe('runRankingTick', () => {
      it('publishes ranking.updated when dirty, then nothing on a second call', async () => {
        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)
        markRankingDirty()

        await runRankingTick(db, bus)

        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'ranking.updated' }))

        await runRankingTick(db, bus)

        expect(fn).toHaveBeenCalledTimes(1)
      })

      it('publishes nothing when never marked dirty', async () => {
        const bus = createSseBus()
        const fn = vi.fn()
        bus.subscribe(fn)

        await runRankingTick(db, bus)

        expect(fn).not.toHaveBeenCalled()
      })

      it('does not throw when the db rejects', async () => {
        const bus = createSseBus()
        const failingDb = {
          ...db,
          select: () => {
            throw new Error('db is down')
          },
        } as unknown as typeof db
        markRankingDirty()

        await expect(runRankingTick(failingDb, bus)).resolves.toBeUndefined()
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
      .values({
        name: 'Round 1',
        durationMinutes: 30,
        status: 'open',
        openedAt: new Date(),
        closesAt,
      })
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

    const second = await frames.next()
    expect(second).toContain('event: ranking.updated')
    expect(JSON.parse(second.split('data: ')[1] ?? '')).toMatchObject({
      round: { roundId: round.id },
    })

    // The handler's own continuation (subscribing to the bus) runs after
    // `writeSSE`'s promise resolves, which can trail the client having
    // already read that same chunk by a tick or two — give it one before
    // publishing, or the event below has no subscriber yet to catch it.
    await new Promise((resolve) => setTimeout(resolve, 0))
    k.resolve('sseBus').publish({ type: 'heartbeat', serverTime: new Date() })

    const third = await frames.next()
    expect(third).toContain('event: heartbeat')

    await frames.cancel()
  })

  it('delivers an event published while the initial snapshot is still being built', async () => {
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
    const token = await tokenFor(user)

    const res = await app.request('/sse', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.body) throw new Error('expected a streamed body')
    const frames = createFrameReader(res.body)

    // Published with no tick in between, unlike the test above: the handler is
    // still inside `buildStateSyncEvent`, two queries away from having anything
    // written. Subscribing only after the snapshot dropped this event on the
    // floor, and a `round.opened` lost here never came back — the home screen
    // learns the current round from `state.sync` or `round.opened` and from
    // nothing else, so the participant stayed on "waiting for the next round"
    // until a reload (#150).
    const closesAt = new Date(Date.now() + 60_000)
    k.resolve('sseBus').publish({
      type: 'round.opened',
      serverTime: new Date(),
      roundId: 'round-opened-mid-snapshot',
      closesAt,
    })

    // The two initial frames still come first, in order...
    expect(await frames.next()).toContain('event: state.sync')
    expect(await frames.next()).toContain('event: ranking.updated')

    // ...and only then the buffered one, rather than never.
    const buffered = await frames.next()
    expect(buffered).toContain('event: round.opened')
    expect(JSON.parse(buffered.split('data: ')[1] ?? '')).toMatchObject({
      roundId: 'round-opened-mid-snapshot',
    })

    await frames.cancel()
  })

  // #274 replaces #232's per-heartbeat `findUserById`: nothing on the stream
  // reads the users table any more, so the row going false is invisible to a
  // live connection until the bus says so. This is the behavioural form of the
  // acceptance criterion "zero session-revalidation queries per second" — if
  // any revalidation came back, one of these heartbeats would kill the stream.
  it('keeps the stream open across heartbeats after the row was flipped, with no revalidation query', async () => {
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
    const token = await tokenFor(user)

    const res = await app.request('/sse', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.body) throw new Error('expected a streamed body')
    const frames = createFrameReader(res.body)

    expect(await frames.next()).toContain('event: state.sync')
    expect(await frames.next()).toContain('event: ranking.updated')

    await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, user.id))

    // Same tick given to the happy-path test above: the handler's bus
    // subscription runs after `writeSSE`'s promise resolves.
    await new Promise((resolve) => setTimeout(resolve, 0))

    for (let i = 0; i < 3; i++) {
      k.resolve('sseBus').publish({ type: 'heartbeat', serverTime: new Date() })
      expect(await frames.next()).toContain('event: heartbeat')
    }

    await frames.cancel()
  })

  it('closes the stream on user.deactivated, without waiting for a heartbeat', async () => {
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
    const token = await tokenFor(user)

    const res = await app.request('/sse', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.body) throw new Error('expected a streamed body')
    const frames = createFrameReader(res.body)

    expect(await frames.next()).toContain('event: state.sync')
    expect(await frames.next()).toContain('event: ranking.updated')

    await new Promise((resolve) => setTimeout(resolve, 0))
    k.resolve('sseBus').publish({ type: 'user.deactivated', userId: user.id })

    // No heartbeat in between, and no frame carrying the control event: it is
    // consumed by the handler, never written to the wire. What IS written is
    // the terminal `session.revoked` (#291), so the client stops instead of
    // reading the clean end as a drop and reconnecting — and it names nobody.
    const revoked = await frames.next()
    expect(revoked).toContain('event: session.revoked')
    const payload = JSON.parse(revoked.split('data: ')[1] ?? '')
    expect(Object.keys(payload).sort()).toEqual(['serverTime', 'type'])
    expect(revoked).not.toContain(user.id)
    expect(revoked).not.toContain('user.deactivated')

    // ...and only then does the stream end.
    await expect(frames.next()).rejects.toThrow('stream closed before a full SSE frame arrived')
  })

  it('ignores a user.deactivated aimed at a different user', async () => {
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
    const token = await tokenFor(user)

    const res = await app.request('/sse', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.body) throw new Error('expected a streamed body')
    const frames = createFrameReader(res.body)

    expect(await frames.next()).toContain('event: state.sync')
    expect(await frames.next()).toContain('event: ranking.updated')

    await new Promise((resolve) => setTimeout(resolve, 0))
    k.resolve('sseBus').publish({ type: 'user.deactivated', userId: crypto.randomUUID() })
    k.resolve('sseBus').publish({ type: 'heartbeat', serverTime: new Date() })

    // Somebody else's ban is not this connection's problem — and the control
    // event itself must not surface as a frame, or it would hand that user's
    // id to every other client.
    const next = await frames.next()
    expect(next).toContain('event: heartbeat')
    expect(next).not.toContain('user.deactivated')
    expect(next).not.toContain('session.revoked')

    await frames.cancel()
  })

  // The race the `closed` latch exists for: at this point the handler is still
  // inside `buildStateSyncEvent`, so `closeStream` is `undefined` and there is
  // nothing for the subscriber to call. Without the latch the handler would go
  // on to `await new Promise` and hang there forever, leaving a deactivated
  // account holding an open stream for the rest of the event.
  it('closes a stream deactivated while the initial snapshot is still being built', async () => {
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
    const token = await tokenFor(user)

    const res = await app.request('/sse', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.body) throw new Error('expected a streamed body')
    const frames = createFrameReader(res.body)

    // No tick in between, unlike the tests above: published while the snapshot
    // is still two queries away from being written.
    k.resolve('sseBus').publish({ type: 'user.deactivated', userId: user.id })

    // The snapshot already in flight still goes out...
    expect(await frames.next()).toContain('event: state.sync')
    expect(await frames.next()).toContain('event: ranking.updated')

    // ...then the terminal event (#291), after the snapshot and never before
    // it, and then the stream ends instead of staying open forever.
    expect(await frames.next()).toContain('event: session.revoked')
    await expect(frames.next()).rejects.toThrow('stream closed before a full SSE frame arrived')
  })
})
