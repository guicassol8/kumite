import { performance } from 'node:perf_hooks'

import { type SseEvent, SseEventSchema } from '../modules/sse/sse.schema'

import { rankingDigest } from './ranking-digest'
import type { Recorder } from './recorder'
import { type ByteStats, createEventTally, createSseParser } from './sse-parser'

// One `/sse` connection held open by the load harness (#136). fetch with the
// Authorization header (the route reads no query token, so no EventSource),
// every payload validated against the back's own `SseEventSchema` — each
// distinct payload once per run, through a shared cache (#442, below).

// --- One validation per distinct payload (#442) ---
//
// Every open stream receives the same frames; since #439 the bytes are
// identical on every connection. Validating each frame on all 400 connections
// (JSON.parse, the zod union, and for a ranking two more zod parses, a
// canonical JSON and a sha256) saturated the harness's single thread, and its
// heartbeat gaps and poll gaps then measured the harness. The answer depends
// only on the text, so a cache keyed by the `data:` text validates each
// distinct payload once; every connection still counts its own invalid
// payloads and keeps its own last ranking digest.

export type PayloadClass =
  | { ok: true; type: SseEvent['type']; rankingDigest: string | null; bytes: number }
  | { ok: false }

export type PayloadCache = {
  classify: (data: string) => PayloadClass
  // distinct: payloads validated; reused: answers served from the cache.
  stats: () => { distinct: number; reused: number }
}

function validatePayload(data: string): PayloadClass {
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch {
    payload = undefined
  }
  const parsed = SseEventSchema.safeParse(payload)
  if (!parsed.success) return { ok: false }
  return {
    ok: true,
    type: parsed.data.type,
    rankingDigest: parsed.data.type === 'ranking.updated' ? rankingDigest(parsed.data) : null,
    bytes: Buffer.byteLength(data),
  }
}

/**
 * The answers for the last `maxEntries` distinct payloads, the least recently
 * used dropped first (64 rankings of 130 KB: about 8 MB of keys).
 */
export function createPayloadCache({
  maxEntries = 64,
}: {
  maxEntries?: number
} = {}): PayloadCache {
  const entries = new Map<string, PayloadClass>()
  let distinct = 0
  let reused = 0
  return {
    classify(data) {
      const hit = entries.get(data)
      if (hit) {
        reused += 1
        // Refreshed: a Map iterates in insertion order, oldest first.
        entries.delete(data)
        entries.set(data, hit)
        return hit
      }
      distinct += 1
      const answer = validatePayload(data)
      entries.set(data, answer)
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next()
        if (!oldest.done) entries.delete(oldest.value)
      }
      return answer
    },
    stats: () => ({ distinct, reused }),
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type SseState = 'open' | 'failed' | 'dropped' | 'closed'

export type SseConnectionReport = {
  state: SseState
  // Why it never opened: the status (and envelope code) or the network error.
  failure: { status: number | null; errorCode: string | null; reason: string } | null
  // Why an open stream ended without the harness closing it.
  dropReason: string | null
  events: Record<string, number>
  heartbeatIntervalsMs: number[]
  // #138: the largest gap between two heartbeats on this connection.
  maxHeartbeatGapMs: number | null
  // #138: payload bytes per event type (the `data:` line, UTF-8).
  bytes: Record<string, ByteStats>
  // #138: from the start of the connect to the response headers, and to
  // the first event of each type.
  headersMs: number | null
  firstEventMs: Record<string, number>
  // #138: digest of the last ranking.updated (see ranking-digest.ts).
  lastRankingDigest: string | null
  invalidPayloads: number
  // The first few invalid payloads, verbatim, for the report.
  invalidSamples: string[]
}

export type SseConnection = {
  report: () => SseConnectionReport
  // Ends the stream from the harness side; the connection counts as closed,
  // not dropped. Safe to call on a failed or already-ended connection.
  close: () => Promise<void>
  // Settles when the read loop is over, whoever ended it.
  ended: Promise<void>
}

const MAX_INVALID_SAMPLES = 3

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timeout'
    const code = (error as Error & { cause?: { code?: unknown } }).cause?.code
    return typeof code === 'string' ? code : error.message
  }
  return String(error)
}

async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // not the JSON envelope — the status alone tells the story
  }
  return null
}

/**
 * Opens one connection and resolves once its fate is known: open (the read
 * loop keeps going in the background) or failed. Never rejects — a failure
 * is data for the report. `connectTimeoutMs` bounds the wait for the
 * response headers only; an open stream has no deadline.
 */
export async function connectSse({
  url,
  token,
  fetch,
  connectTimeoutMs,
  recorder,
  now = () => performance.now(),
  payloads = createPayloadCache(),
}: {
  url: string
  token: string
  fetch: FetchLike
  connectTimeoutMs: number
  recorder?: Pick<Recorder, 'recordHttp'>
  now?: () => number
  // Shared by every connection of a run (#442); one of its own otherwise.
  payloads?: PayloadCache
}): Promise<SseConnection> {
  const tally = createEventTally()
  const started = now()
  const report: SseConnectionReport = {
    state: 'failed',
    failure: null,
    dropReason: null,
    events: {},
    heartbeatIntervalsMs: [],
    maxHeartbeatGapMs: null,
    bytes: {},
    headersMs: null,
    firstEventMs: {},
    lastRankingDigest: null,
    invalidPayloads: 0,
    invalidSamples: [],
  }
  const snapshot = (): SseConnectionReport => {
    const { counts, heartbeatIntervalsMs, maxHeartbeatGapMs, bytes, firstAt } = tally.snapshot()
    return {
      ...report,
      failure: report.failure ? { ...report.failure } : null,
      events: counts,
      heartbeatIntervalsMs,
      maxHeartbeatGapMs,
      bytes,
      firstEventMs: Object.fromEntries(
        Object.entries(firstAt).map(([type, at]) => [type, at - started]),
      ),
      invalidSamples: [...report.invalidSamples],
    }
  }
  const settled: SseConnection = {
    report: snapshot,
    close: async () => {},
    ended: Promise.resolve(),
  }

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException('connect timeout', 'TimeoutError')),
    connectTimeoutMs,
  )
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    const reason = describeError(error)
    recorder?.recordHttp({
      method: 'GET',
      url,
      status: null,
      errorCode: null,
      ms: now() - started,
      networkError: reason,
    })
    report.failure = { status: null, errorCode: null, reason }
    return settled
  }
  clearTimeout(timer)

  const contentType = res.headers.get('content-type') ?? ''
  if (res.status !== 200 || !contentType.includes('text/event-stream') || !res.body) {
    const errorCode = res.status === 200 ? null : await readErrorCode(res)
    recorder?.recordHttp({ method: 'GET', url, status: res.status, errorCode, ms: now() - started })
    report.failure = {
      status: res.status,
      errorCode,
      reason:
        res.status === 200 ? `content-type ${contentType || 'missing'}` : `HTTP ${res.status}`,
    }
    if (res.status === 200) await res.body?.cancel().catch(() => {})
    return settled
  }
  // Time to headers: the body of a stream never ends on its own.
  report.headersMs = now() - started
  recorder?.recordHttp({ method: 'GET', url, status: 200, errorCode: null, ms: report.headersMs })
  report.state = 'open'

  let closedByHarness = false
  let lastType: string | null = null
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = createSseParser((frame) => {
    const payload = payloads.classify(frame.data)
    if (!payload.ok) {
      report.invalidPayloads += 1
      if (report.invalidSamples.length < MAX_INVALID_SAMPLES) {
        report.invalidSamples.push(frame.data.slice(0, 200))
      }
      return
    }
    lastType = payload.type
    if (payload.rankingDigest !== null) report.lastRankingDigest = payload.rankingDigest
    tally.record(payload.type, now(), payload.bytes)
  })

  const ended = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        parser.push(decoder.decode(value, { stream: true }))
      }
      if (closedByHarness) report.state = 'closed'
      else {
        report.state = 'dropped'
        report.dropReason = lastType === 'session.revoked' ? 'session.revoked' : 'stream_ended'
      }
    } catch (error) {
      if (closedByHarness) report.state = 'closed'
      else {
        report.state = 'dropped'
        report.dropReason = describeError(error)
      }
    }
  })()

  return {
    report: snapshot,
    ended,
    close: async () => {
      if (report.state !== 'open') return
      closedByHarness = true
      controller.abort()
      // In-process (app.request) the abort alone never reaches hono's
      // onAbort; cancelling the reader does — same as sse.test.ts.
      await reader.cancel().catch(() => {})
      await ended
    },
  }
}
