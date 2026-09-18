import { JUDGE_TIMEOUT_MS } from '../../config'
import type { Db } from '../../db/client'
import { getEventRanking, getRoundRanking } from '../ranking/ranking.service'
import {
  clearPendingRoundClosure,
  findOpenRound,
  pendingRoundClosures,
  reapExpiredRound,
} from '../rounds/rounds.service'
import { hasJudgingInFlight } from '../submissions/submissions.service'

import type { RankingUpdatedEvent, SseBusEvent, StateSyncEvent } from './sse.schema'

// Carries `SseBusEvent`, not `SseEvent`: besides the wire contract the bus
// also moves internal control events that must never be written to a stream
// (#274, see sse.schema.ts). Subscribers are handed the wider type on purpose
// — the route has to narrow before it can write.
export type SseBus = {
  subscribe: (fn: (event: SseBusEvent) => void) => () => void
  publish: (event: SseBusEvent) => void
}

// Pure in-memory pub/sub — no timers, no I/O. The 1s expiry tick is wired
// from main.ts (bootstrap), not here, so importing this module never starts
// a background process (see the plan's architecture note: tests that import
// app.ts/context.ts must not inherit a live DB-polling timer).
export function createSseBus(): SseBus {
  const subscribers = new Set<(event: SseBusEvent) => void>()
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

/**
 * Tells every live `/sse` handler that this account was deactivated, so the
 * one belonging to it can close (#274).
 *
 * Internal, never written to a stream — see `SseControlEvent` in
 * sse.schema.ts for why it is not part of the wire union. Published by
 * `deactivateUserRoute`, not by `deactivateUser`: services here stay pure
 * (back/AGENTS.md) and the bus is already the route's to reach for, exactly
 * as rounds.route.ts does for round.opened/extended/closed.
 */
export function publishUserDeactivated(bus: SseBus, userId: string) {
  bus.publish({ type: 'user.deactivated', userId })
}

// How long a closed round's announcement waits for judging to drain (#176).
// A submission accepted at the buzzer is still in the sandbox when the round
// ends, and the front fetches a closed round's ranking exactly once, on this
// event — announcing before the row lands shows a leaderboard missing it.
//
// The ceiling exists so a stuck worker cannot hold the event forever: a whole
// judging run is several cases at JUDGE_TIMEOUT_MS each plus sandbox startup,
// so the per-case timeout alone is not enough and the slack covers the rest.
// Past it the event goes out regardless — a late leaderboard is worse than a
// slightly incomplete one.
export const ROUND_CLOSE_ANNOUNCE_MAX_WAIT_MS = JUDGE_TIMEOUT_MS + 10_000

/**
 * Publishes `round.closed` for every round closed but not yet announced,
 * holding back only those still judging and still inside the ceiling.
 *
 * Called both by the expiry tick and, right after an organizer's manual
 * close, by the route — so a close with nothing in flight is still announced
 * synchronously rather than waiting for the next tick.
 */
export function announceClosedRounds(bus: SseBus, now = Date.now()): void {
  for (const { roundId, closedAt } of pendingRoundClosures()) {
    const waitedMs = now - closedAt.getTime()
    if (hasJudgingInFlight(roundId) && waitedMs < ROUND_CLOSE_ANNOUNCE_MAX_WAIT_MS) continue

    clearPendingRoundClosure(roundId)
    publishRoundClosed(bus, { id: roundId })
  }
}

// A background tick must not crash the process: a DB error is caught and
// logged, never thrown. The heartbeat always fires — success or failure —
// since it's also what tells connected clients the stream is still alive.
export async function runExpiryTick(db: Db, bus: SseBus): Promise<void> {
  try {
    // The return value is deliberately ignored: a read path may have reaped
    // the round before this tick ran, so what to announce comes from the
    // pending set, never from the rows this particular call happened to close.
    await reapExpiredRound(db)
    announceClosedRounds(bus)
  } catch (error) {
    console.error('sse expiry tick failed', error)
  }
  bus.publish({ type: 'heartbeat', serverTime: new Date() })
}

// --- Ranking debounce (#44) ---
//
// Process-local flag, same pattern as inFlightIdentities/cooldownUntil in
// submissions.service.ts: a single API process is what this event runs.
// Reuses the 1s expiry tick (wired from main.ts) rather than a timer of its
// own, so a burst of submissions collapses into at most one emission per
// tick regardless of how many mark the ranking dirty in between.
let rankingDirty = false

export function markRankingDirty(): void {
  rankingDirty = true
}

export async function buildRankingUpdatedEvent(db: Db): Promise<RankingUpdatedEvent> {
  const openRound = await findOpenRound(db)
  return {
    type: 'ranking.updated',
    serverTime: new Date(),
    round: openRound ? await getRoundRanking(db, openRound.id) : null,
    event: await getEventRanking(db),
  }
}

// Clears the flag before computing the snapshot, not after: a submission
// that marks dirty while the snapshot is being built must not be lost to a
// clear that lands after that submission's own mark.
export async function runRankingTick(db: Db, bus: SseBus): Promise<void> {
  if (!rankingDirty) return
  rankingDirty = false

  try {
    const event = await buildRankingUpdatedEvent(db)
    bus.publish(event)
  } catch (error) {
    console.error('sse ranking tick failed', error)
  }
}
