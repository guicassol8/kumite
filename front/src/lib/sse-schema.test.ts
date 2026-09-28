import { describe, expect, it } from 'vitest'

import {
  RankingUpdatedEventSchema,
  SessionRevokedEventSchema,
  SseEventSchema,
  StateSyncEventSchema,
} from './sse-schema'

// The front mirrors back/src/modules/sse/sse.schema.ts by hand (the `/sse`
// channel is outside the typed RPC client), so the wire contract is pinned on
// both sides — this file is the front half of that round-trip.
describe('sse-schema', () => {
  // #291: the terminal frame of a revoked session. Arrives as JSON, so
  // `serverTime` is an ISO string on the wire and a `Date` once parsed.
  it('round-trips a session.revoked event', () => {
    const serverTime = new Date()
    const wire = JSON.parse(JSON.stringify({ type: 'session.revoked', serverTime }))

    const parsed = SseEventSchema.parse(wire)

    expect(parsed).toEqual({ type: 'session.revoked', serverTime })
    expect(parsed.serverTime).toBeInstanceOf(Date)
    expect(SessionRevokedEventSchema.safeParse(wire).success).toBe(true)
  })

  // #285: the organizer's pause toggle, both directions.
  it('round-trips submissions.paused and submissions.resumed', () => {
    const serverTime = new Date()
    for (const type of ['submissions.paused', 'submissions.resumed'] as const) {
      const wire = JSON.parse(JSON.stringify({ type, serverTime }))
      expect(SseEventSchema.parse(wire)).toEqual({ type, serverTime })
    }
  })

  it('requires submissionsPaused on state.sync', () => {
    const base = { type: 'state.sync', serverTime: new Date().toISOString(), round: null }
    expect(StateSyncEventSchema.safeParse(base).success).toBe(false)
    expect(StateSyncEventSchema.parse({ ...base, submissionsPaused: true }).submissionsPaused).toBe(
      true,
    )
  })

  // #274: the back's internal control event must never parse as a wire event,
  // here any more than there.
  it('rejects the internal user.deactivated control event', () => {
    const event = { type: 'user.deactivated', userId: crypto.randomUUID() }
    expect(SseEventSchema.safeParse(event).success).toBe(false)
  })

  // #318: `z.object` strips unknown keys, so a mirror without `denominators`
  // silently dropped the verdict exactly while a round is live over SSE.
  describe('ranking.updated round denominators (#318)', () => {
    const round = {
      roundId: 'round-1',
      roundName: 'Rodada 1',
      problemIds: ['problem-1'],
      teams: [],
    }
    const event = { teams: [] }

    it('round-trips a ranking.updated event keeping round.denominators', () => {
      for (const denominators of ['consistent', 'inconsistent', 'unknown'] as const) {
        const wire = JSON.parse(
          JSON.stringify({
            type: 'ranking.updated',
            serverTime: new Date(),
            round: { ...round, denominators },
            event,
          }),
        )

        const parsed = SseEventSchema.parse(wire)

        expect(parsed.type === 'ranking.updated' && parsed.round?.denominators).toBe(denominators)
      }
    })

    it('rejects a ranking.updated round without denominators', () => {
      const wire = {
        type: 'ranking.updated',
        serverTime: new Date().toISOString(),
        round,
        event,
      }
      expect(RankingUpdatedEventSchema.safeParse(wire).success).toBe(false)
    })
  })
})
