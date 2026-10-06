import { performance } from 'node:perf_hooks'

import { JUDGE_TIMEOUT_MS } from '../../config'
import type { Db } from '../../db/client'
import { pushBounded } from '../../lib/ring'
import { getEventConfig } from '../event-config/event-config.service'
import { getEventRanking, getRoundRanking } from '../ranking/ranking.service'
import {
  clearPendingRoundClosure,
  findOpenRound,
  pendingRoundClosures,
  reapExpiredRound,
} from '../rounds/rounds.service'
import { hasJudgingInFlight } from '../submissions/submissions.service'

import type {
  RankingStages,
  RankingUpdatedEvent,
  SseBusEvent,
  SseConnect,
  SseEmission,
  SseEvent,
  SseTimings,
  StateSyncEvent,
} from './sse.schema'

// Carries `SseBusEvent`, not `SseEvent`: besides the wire contract the bus
// also moves internal control events that must never be written to a stream
// (#274, see sse.schema.ts). Subscribers are handed the wider type on purpose
// — the route has to narrow before it can write. And it is narrower than the
// wire on the other side: `session.revoked` is per-connection and cannot be
// published here (#291).
export type SseBus = {
  subscribe: (fn: (event: SseBusEvent) => void) => () => void
  publish: (event: SseBusEvent) => void
  // Current subscriber count. The `/sse` handler is the bus's only subscriber,
  // one per open stream, so this is the number of live SSE connections the
  // organizer's live card reports (#279). A new subscriber elsewhere would
  // have to be accounted for here.
  connections: () => number
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
    connections() {
      return subscribers.size
    },
  }
}

// --- The wire frame (#439) ---
//
// One emission goes to every open stream, and the event ranking it carries
// is 90–130 KB. Serialized and encoded per connection, that was N
// JSON.stringify inside the synchronous publish plus N copies split and
// re-encoded by hono's `writeSSE`, each one held in its own stream's queue
// (#138: 130–600 ms per emission, RSS up to 2 GB). Encoded once, every
// connection is handed the same `Uint8Array`: hono writes a `Uint8Array` as
// is, and Node queues a view of it, never a copy.
const frames = new WeakMap<SseEvent, Uint8Array>()
const encoder = new TextEncoder()

/**
 * The SSE frame for `event`, `event: <type>\ndata: <json>\n\n` in UTF-8 —
 * byte for byte what hono's `writeSSE({ event: type, data: json })` writes,
 * with a single `data:` line because `JSON.stringify` never emits a raw line
 * break.
 *
 * Memoized per event object, so the first subscriber to write an emission
 * pays for it and the rest reuse the same buffer. That relies on every event
 * being a fresh object per publish and never mutated after it — which is how
 * every `publish*`/`build*` helper here creates them. Mutating an event after
 * it was written would send the old bytes.
 */
export function encodeSseFrame(event: SseEvent): Uint8Array {
  let frame = frames.get(event)
  if (!frame) {
    frame = encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    frames.set(event, frame)
  }
  return frame
}

export async function buildStateSyncEvent(db: Db): Promise<StateSyncEvent> {
  const [round, { submissionsPaused }] = await Promise.all([findOpenRound(db), getEventConfig(db)])
  return {
    type: 'state.sync',
    serverTime: new Date(),
    round: round ? { id: round.id, closesAt: round.closesAt } : null,
    submissionsPaused,
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
 * Announces the organizer's pause toggle to every connected client (#285).
 * Published by `updateEventConfigRoute`, not the service, for the same reason
 * as the round helpers above: services stay pure and the bus is the route's.
 */
export function publishSubmissionsPaused(bus: SseBus, paused: boolean) {
  bus.publish({
    type: paused ? 'submissions.paused' : 'submissions.resumed',
    serverTime: new Date(),
  })
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

// --- Timings for the load harness (#138) ---
//
// Bounded rings read by GET /organizer/stats/process, process-local like the
// ranking flag below. Each entry costs a few performance.now().
const SSE_EMISSIONS_KEEP = 256
const SSE_CONNECTS_KEEP = 1024
const emissions: SseEmission[] = []
const connects: SseConnect[] = []
let emissionSeq = 0
let connectSeq = 0
let snapshotsBuilding = 0

/**
 * Publishes `event` and records what the synchronous fan-out cost: encoding
 * the frame once, in the first subscriber (`encodeSseFrame`, #439), plus each
 * subscriber queueing its write of that same buffer. The socket write itself
 * happens after it.
 */
function publishTimed(
  bus: SseBus,
  event: SseBusEvent,
  kind: SseEmission['kind'],
  stages: RankingStages | null,
): void {
  const subscribers = bus.connections()
  const started = performance.now()
  bus.publish(event)
  const publishMs = performance.now() - started
  emissionSeq++
  pushBounded(
    emissions,
    { seq: emissionSeq, endedAt: Date.now(), kind, subscribers, publishMs, stages },
    SSE_EMISSIONS_KEEP,
  )
}

/**
 * Called by the `/sse` handler as it starts building a connect snapshot.
 * Returns how many snapshots are being built now, this one included; every
 * call is paired with one `sseConnectFinished`.
 */
export function sseConnectStarted(): number {
  snapshotsBuilding++
  return snapshotsBuilding
}

/** Ends a `sseConnectStarted`; records the timings of one that completed. */
export function sseConnectFinished(timings: Omit<SseConnect, 'seq' | 'endedAt'> | null): void {
  snapshotsBuilding = Math.max(0, snapshotsBuilding - 1)
  if (!timings) return
  connectSeq++
  pushBounded(connects, { ...timings, seq: connectSeq, endedAt: Date.now() }, SSE_CONNECTS_KEEP)
}

/** The recent emissions and connects. Read-only. */
export function getSseTimings(): SseTimings {
  return { emissions: [...emissions], connects: [...connects] }
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
  publishTimed(bus, { type: 'heartbeat', serverTime: new Date() }, 'heartbeat', null)
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
  return (await buildRankingUpdatedEventTimed(db)).event
}

/** The same snapshot, with what each of its three queries took (#138). */
export async function buildRankingUpdatedEventTimed(
  db: Db,
): Promise<{ event: RankingUpdatedEvent; stages: RankingStages }> {
  const started = performance.now()
  const openRound = await findOpenRound(db)
  const opened = performance.now()
  const round = openRound ? await getRoundRanking(db, openRound.id) : null
  const ranked = performance.now()
  const event = await getEventRanking(db)
  const ended = performance.now()
  return {
    event: { type: 'ranking.updated', serverTime: new Date(), round, event },
    stages: {
      openRoundMs: opened - started,
      roundRankingMs: ranked - opened,
      eventRankingMs: ended - ranked,
    },
  }
}

// Clears the flag before computing the snapshot, not after: a submission
// that marks dirty while the snapshot is being built must not be lost to a
// clear that lands after that submission's own mark.
export async function runRankingTick(db: Db, bus: SseBus): Promise<void> {
  if (!rankingDirty) return
  rankingDirty = false

  try {
    const { event, stages } = await buildRankingUpdatedEventTimed(db)
    publishTimed(bus, event, 'ranking', stages)
  } catch (error) {
    console.error('sse ranking tick failed', error)
  }
}
