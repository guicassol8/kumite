import { performance } from 'node:perf_hooks'

import { rankingDigest } from './ranking-digest'
import type { Recorder } from './recorder'
import { sleep } from './schedule'
import type { SseConnection } from './sse-client'
import { resendIfStale, type Transport } from './transport'

// The checks that close a burst (#137, #138), run after the load and again
// after the reconnect storm: the judge drained with no worker left behind,
// and every open SSE connection's last ranking is the same one the API
// returns. Both poll with a deadline instead of trusting one read: the last
// ranking tick and the last worker's exit can trail the load by a second.

export const SETTLE_DEADLINE_MS = 15_000
const POLL_MS = 250

export type DrainCheck = {
  drained: boolean
  waitedMs: number
  // The last read; null when it could not be read at all.
  inFlight: number | null
  waiting: number | null
  workersAlive: number | null
}

export type ConsistencyCheck = {
  // Open connections compared.
  compared: number
  // Of them, those that never received a ranking.updated.
  withoutRanking: number
  distinctDigests: number
  // Null when there was nothing to compare.
  matchesApi: boolean | null
  apiDigest: string | null
  waitedMs: number
}

/**
 * The verdict on one set of digests: every compared connection has one, they
 * are all the same, and it is the API's. Nothing to compare is consistent.
 */
export function evaluateConsistency(
  digests: readonly (string | null)[],
  apiDigest: string | null,
): Omit<ConsistencyCheck, 'waitedMs' | 'apiDigest'> & { consistent: boolean } {
  const present = digests.filter((digest): digest is string => digest !== null)
  const distinct = new Set(present)
  const compared = digests.length
  const matchesApi =
    compared === 0
      ? null
      : present.length === compared && distinct.size === 1 && distinct.has(apiDigest ?? '')
  return {
    compared,
    withoutRanking: compared - present.length,
    distinctDigests: distinct.size,
    matchesApi,
    consistent: matchesApi !== false,
  }
}

/** Polls the live card and the worker counter until the judge is idle. */
type Retrying = Pick<Recorder, 'recordRetry'>

export async function waitForDrain({
  transport,
  recorder,
  organizerToken,
  deadlineMs = SETTLE_DEADLINE_MS,
}: {
  transport: Transport
  recorder: Retrying
  organizerToken: string
  deadlineMs?: number
}): Promise<DrainCheck> {
  const api = transport.api(organizerToken)
  const started = performance.now()
  let last: DrainCheck = {
    drained: false,
    waitedMs: 0,
    inFlight: null,
    waiting: null,
    workersAlive: null,
  }
  for (;;) {
    try {
      const [live, proc] = await Promise.all([
        resendIfStale(recorder, 'GET', '/organizer/stats/live', () =>
          api.organizer.stats.live.$get(),
        ),
        // A cut in the future: only the counters are wanted, not the rings.
        resendIfStale(recorder, 'GET', '/organizer/stats/process', () =>
          api.organizer.stats.process.$get({ query: { since: Date.now() + 3_600_000 } }),
        ),
      ])
      if (live.status === 200 && proc.status === 200) {
        const { judge } = await live.json()
        const { judge: timings } = await proc.json()
        last = {
          drained: judge.inFlight === 0 && judge.waiting === 0 && timings.workers.alive === 0,
          waitedMs: performance.now() - started,
          inFlight: judge.inFlight,
          waiting: judge.waiting,
          workersAlive: timings.workers.alive,
        }
      }
    } catch {
      // recorded by the transport; try again until the deadline
    }
    if (last.drained || performance.now() - started >= deadlineMs) {
      return { ...last, waitedMs: performance.now() - started }
    }
    await sleep(POLL_MS)
  }
}

async function readApiDigest(
  transport: Transport,
  recorder: Retrying,
  organizerToken: string,
  roundId: string | null,
): Promise<string | null> {
  const api = transport.api(organizerToken)
  try {
    const [round, event] = await Promise.all([
      roundId
        ? resendIfStale(recorder, 'GET', `/rounds/${roundId}/ranking`, () =>
            api.rounds[':id'].ranking.$get({ param: { id: roundId } }),
          )
        : null,
      resendIfStale(recorder, 'GET', '/ranking', () => api.ranking.$get()),
    ])
    if (event.status !== 200 || (round && round.status !== 200)) return null
    return rankingDigest({
      round: round && round.status === 200 ? await round.json() : null,
      event: await event.json(),
    })
  } catch {
    return null
  }
}

/**
 * Polls until every open connection's last ranking.updated has the API's
 * digest, or the deadline passes; returns the last comparison.
 */
export async function waitForConsistency({
  transport,
  recorder,
  organizerToken,
  roundId,
  connections,
  deadlineMs = SETTLE_DEADLINE_MS,
}: {
  transport: Transport
  recorder: Retrying
  organizerToken: string
  roundId: string | null
  connections: readonly SseConnection[]
  deadlineMs?: number
}): Promise<ConsistencyCheck> {
  const started = performance.now()
  for (;;) {
    const open = connections.map((c) => c.report()).filter((r) => r.state === 'open')
    const apiDigest = await readApiDigest(transport, recorder, organizerToken, roundId)
    const { consistent, ...result } = evaluateConsistency(
      open.map((r) => r.lastRankingDigest),
      apiDigest,
    )
    const waitedMs = performance.now() - started
    if (consistent || waitedMs >= deadlineMs) return { ...result, apiDigest, waitedMs }
    await sleep(POLL_MS)
  }
}
