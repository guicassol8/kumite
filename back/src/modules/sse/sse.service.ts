import type { Db } from '../../db/client'
import { findOpenRound, reapExpiredRound } from '../rounds/rounds.service'

import type { SseEvent, StateSyncEvent } from './sse.schema'

export type SseBus = {
  subscribe: (fn: (event: SseEvent) => void) => () => void
  publish: (event: SseEvent) => void
}

// Pure in-memory pub/sub — no timers, no I/O. The 1s expiry tick is wired
// from main.ts (bootstrap), not here, so importing this module never starts
// a background process (see the plan's architecture note: tests that import
// app.ts/context.ts must not inherit a live DB-polling timer).
export function createSseBus(): SseBus {
  const subscribers = new Set<(event: SseEvent) => void>()
  return {
    subscribe(fn) {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    publish(event) {
      for (const fn of subscribers) fn(event)
    },
  }
}

export async function buildStateSyncEvent(db: Db): Promise<StateSyncEvent> {
  const round = await findOpenRound(db)
  return {
    type: 'state.sync',
    serverTime: new Date(),
    round: round ? { id: round.id, closesAt: round.closesAt } : null,
  }
}

export function publishRoundOpened(bus: SseBus, round: { id: string; closesAt: Date }) {
  bus.publish({
    type: 'round.opened',
    serverTime: new Date(),
    roundId: round.id,
    closesAt: round.closesAt,
  })
}

export function publishRoundExtended(bus: SseBus, round: { id: string; closesAt: Date }) {
  bus.publish({
    type: 'round.extended',
    serverTime: new Date(),
    roundId: round.id,
    closesAt: round.closesAt,
  })
}

export function publishRoundClosed(bus: SseBus, round: { id: string }) {
  bus.publish({ type: 'round.closed', serverTime: new Date(), roundId: round.id })
}

// A background tick must not crash the process: a DB error is caught and
// logged, never thrown. The heartbeat always fires — success or failure —
// since it's also what tells connected clients the stream is still alive.
export async function runExpiryTick(db: Db, bus: SseBus): Promise<void> {
  try {
    const closed = await reapExpiredRound(db)
    for (const round of closed) {
      publishRoundClosed(bus, round)
    }
  } catch (error) {
    console.error('sse expiry tick failed', error)
  }
  bus.publish({ type: 'heartbeat', serverTime: new Date() })
}
