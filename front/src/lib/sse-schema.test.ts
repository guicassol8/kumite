import { describe, expect, it } from 'vitest'

import { SessionRevokedEventSchema, SseEventSchema } from './sse-schema'

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

  // #274: the back's internal control event must never parse as a wire event,
  // here any more than there.
  it('rejects the internal user.deactivated control event', () => {
    const event = { type: 'user.deactivated', userId: crypto.randomUUID() }
    expect(SseEventSchema.safeParse(event).success).toBe(false)
  })
})
