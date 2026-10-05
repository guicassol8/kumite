import { performance } from 'node:perf_hooks'

import { SseEventSchema } from '../modules/sse/sse.schema'

import { rankingDigest } from './ranking-digest'
import type { Recorder } from './recorder'
import { type ByteStats, createEventTally, createSseParser } from './sse-parser'

// One `/sse` connection held open by the load harness (#136). fetch with the
// Authorization header (the route reads no query token, so no EventSource),
// every payload validated against the back's own `SseEventSchema`.

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
}: {
  url: string
  token: string
  fetch: FetchLike
  connectTimeoutMs: number
  recorder?: Pick<Recorder, 'recordHttp'>
  now?: () => number
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
    let payload: unknown
    try {
      payload = JSON.parse(frame.data)
    } catch {
      payload = undefined
    }
    const parsed = SseEventSchema.safeParse(payload)
    if (!parsed.success) {
      report.invalidPayloads += 1
      if (report.invalidSamples.length < MAX_INVALID_SAMPLES) {
        report.invalidSamples.push(frame.data.slice(0, 200))
      }
      return
    }
    lastType = parsed.data.type
    if (parsed.data.type === 'ranking.updated') {
      report.lastRankingDigest = rankingDigest(parsed.data)
    }
    tally.record(parsed.data.type, now(), Buffer.byteLength(frame.data))
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
