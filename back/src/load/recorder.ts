import { type Summary, summarize } from './stats'
import { isCoherent, type SubmissionKind, type Verdict } from './verdict'

// The harness's in-memory ledger (#136): every HTTP request, every action
// started and completed, every verdict, by phase. Closures, no class (kata
// verify's no-class covers src/ whole). `snapshot()` is plain JSON.

// settle and storm are #137/#138's: after the load, the judge drains and the
// SSE ranking is checked against the API, then every stream reconnects.
export const PHASES = [
  'rest',
  'setup',
  'sse-ramp',
  'sse-idle',
  'load',
  'settle',
  'storm',
  'teardown',
] as const

export type Phase = (typeof PHASES)[number]

export type HttpRecord = {
  method: string
  url: string
  // null when the request never got an answer (network error, timeout).
  status: number | null
  // The ADR-0008 envelope's `error` on a non-2xx, when the body had one.
  errorCode: string | null
  // Until the end of the body, so a slow stream counts.
  ms: number
  // 'timeout', or the error's code/message.
  networkError?: string | null
  networkDetail?: NetworkErrorDetail
}

export type NetworkErrorDetail = {
  // 'timeout', the error's code (undici: on `cause`), else its message.
  reason: string
  message: string
  // Failed before any response arrived, or while reading the body.
  stage: 'request' | 'body'
  // The socket's counters, when the error carries it; null otherwise.
  socketBytesWritten: number | null
  socketBytesRead: number | null
  // Bytes already read on a socket whose request failed before its own
  // response: earlier responses, so a reused keep-alive socket.
  reusedSocket: boolean | null
}

export type RouteStats = {
  count: number
  // '200', '401:invalid_credentials', 'network'.
  byStatus: Record<string, number>
  // Over the requests that got an answer only.
  latencyMs: Summary
  networkErrors: number
  timeouts: number
  // #138: network errors by `reason · stage · reused`, and the first few.
  networkReasons: Record<string, number>
  networkSamples: NetworkErrorDetail[]
}

export type UnexpectedStatus = {
  phase: Phase
  route: string
  status: number
  errorCode: string | null
  count: number
}

// #138: a request the harness sent again after a stale keep-alive socket.
export type RetryRecord = { phase: Phase; route: string; reason: string; count: number }

export type PhaseSpan = { phase: Phase; startedAt: number; endedAt: number | null }

export type RecorderSnapshot = {
  phases: PhaseSpan[]
  http: Partial<Record<Phase, Record<string, RouteStats>>>
  unexpected: UnexpectedStatus[]
  // Each retry is also in `http` as the network error it answered; the
  // report counts those errors as retried, not as failures.
  retries: RetryRecord[]
  actions: Record<string, { started: number; completed: number }>
  verdicts: {
    matrix: Partial<Record<SubmissionKind, Partial<Record<Verdict, number>>>>
    incoherent: number
  }
  // #137: HTTP latency of the POST that got the 201, by what was sent — the
  // time a participant waits for a verdict.
  submissions: { latencyMs: Partial<Record<SubmissionKind, Summary>> }
  errors: { phase: Phase; message: string }[]
  warnings: string[]
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `METHOD /path`, with every uuid segment as `:id` and no origin or query. */
export function routeKey(method: string, url: string): string {
  const { pathname } = new URL(url, 'http://harness.invalid')
  const path = pathname
    .split('/')
    .map((segment) => (UUID_SEGMENT.test(segment) ? ':id' : segment))
    .join('/')
  return `${method.toUpperCase()} ${path}`
}

type RouteBucket = {
  count: number
  byStatus: Record<string, number>
  latencies: number[]
  networkErrors: number
  timeouts: number
  networkReasons: Record<string, number>
  networkSamples: NetworkErrorDetail[]
}

const MAX_NETWORK_SAMPLES = 5

/** `UND_ERR_SOCKET · request · reused`: the key network errors are counted by. */
export function networkReasonKey(detail: NetworkErrorDetail): string {
  const reuse =
    detail.reusedSocket === null ? 'socket unknown' : detail.reusedSocket ? 'reused' : 'fresh'
  return `${detail.reason} · ${detail.stage} · ${reuse}`
}

export function createRecorder({ clock = () => Date.now() }: { clock?: () => number } = {}) {
  let current: Phase = 'rest'
  const phases: PhaseSpan[] = []
  const http = new Map<Phase, Map<string, RouteBucket>>()
  const unexpected = new Map<string, UnexpectedStatus>()
  const retries = new Map<string, RetryRecord>()
  const actions: Record<string, { started: number; completed: number }> = {}
  const matrix: RecorderSnapshot['verdicts']['matrix'] = {}
  let incoherent = 0
  const submissionLatencies: Partial<Record<SubmissionKind, number[]>> = {}
  const errors: { phase: Phase; message: string }[] = []
  const warnings: string[] = []

  const bucketFor = (route: string): RouteBucket => {
    let byRoute = http.get(current)
    if (!byRoute) {
      byRoute = new Map()
      http.set(current, byRoute)
    }
    let bucket = byRoute.get(route)
    if (!bucket) {
      bucket = {
        count: 0,
        byStatus: {},
        latencies: [],
        networkErrors: 0,
        timeouts: 0,
        networkReasons: {},
        networkSamples: [],
      }
      byRoute.set(route, bucket)
    }
    return bucket
  }

  const action = (kind: string) => {
    actions[kind] ??= { started: 0, completed: 0 }
    return actions[kind]
  }

  return {
    phase: (): Phase => current,

    setPhase(phase: Phase) {
      const now = clock()
      const open = phases.at(-1)
      if (open && open.endedAt === null) open.endedAt = now
      phases.push({ phase, startedAt: now, endedAt: null })
      current = phase
    },

    /** Closes the last phase; called once, when the run is over. */
    endPhases() {
      const open = phases.at(-1)
      if (open && open.endedAt === null) open.endedAt = clock()
    },

    recordHttp(record: HttpRecord) {
      const bucket = bucketFor(routeKey(record.method, record.url))
      bucket.count += 1
      if (record.status === null) {
        bucket.networkErrors += 1
        if (record.networkError === 'timeout') bucket.timeouts += 1
        const detail: NetworkErrorDetail = record.networkDetail ?? {
          reason: record.networkError ?? 'unknown',
          message: record.networkError ?? 'unknown',
          stage: 'request',
          socketBytesWritten: null,
          socketBytesRead: null,
          reusedSocket: null,
        }
        const key = networkReasonKey(detail)
        bucket.networkReasons[key] = (bucket.networkReasons[key] ?? 0) + 1
        if (bucket.networkSamples.length < MAX_NETWORK_SAMPLES) bucket.networkSamples.push(detail)
        bucket.byStatus['network'] = (bucket.byStatus['network'] ?? 0) + 1
        return
      }
      bucket.latencies.push(record.ms)
      const key = record.errorCode ? `${record.status}:${record.errorCode}` : String(record.status)
      bucket.byStatus[key] = (bucket.byStatus[key] ?? 0) + 1
    },

    /**
     * A status the call site did not expect on that route. The call site
     * decides what is expected (a 429 on a submission is, a 409 on a team
     * creation is not); 5xx are failures on their own and are not repeated
     * here.
     */
    recordUnexpected(
      record: Pick<HttpRecord, 'method' | 'url' | 'errorCode'> & { status: number },
    ) {
      const route = routeKey(record.method, record.url)
      const key = `${current}|${route}|${record.status}|${record.errorCode ?? ''}`
      const entry = unexpected.get(key)
      if (entry) entry.count += 1
      else
        unexpected.set(key, {
          phase: current,
          route,
          status: record.status,
          errorCode: record.errorCode,
          count: 1,
        })
    },

    /** A request about to be sent again after the network error `detail`. */
    recordRetry(record: { method: string; url: string; detail: NetworkErrorDetail }) {
      const route = routeKey(record.method, record.url)
      const reason = networkReasonKey(record.detail)
      const key = `${current}|${route}|${reason}`
      const entry = retries.get(key)
      if (entry) entry.count += 1
      else retries.set(key, { phase: current, route, reason, count: 1 })
    },

    actionStarted(kind: string) {
      action(kind).started += 1
    },

    actionCompleted(kind: string) {
      action(kind).completed += 1
    },

    recordVerdict(kind: SubmissionKind, verdict: Verdict) {
      const row = (matrix[kind] ??= {})
      row[verdict] = (row[verdict] ?? 0) + 1
      if (!isCoherent(kind, verdict)) incoherent += 1
    },

    /** The latency of a submission's 201, by kind. */
    recordSubmissionLatency(kind: SubmissionKind, ms: number) {
      ;(submissionLatencies[kind] ??= []).push(ms)
    },

    /** An error that stopped the run in the current phase (setup, ramp...). */
    recordError(message: string) {
      errors.push({ phase: current, message })
    },

    recordWarning(message: string) {
      warnings.push(message)
    },

    snapshot(): RecorderSnapshot {
      const httpOut: RecorderSnapshot['http'] = {}
      for (const [phase, byRoute] of http) {
        const routes: Record<string, RouteStats> = {}
        for (const [route, bucket] of [...byRoute].sort(([a], [b]) => a.localeCompare(b))) {
          routes[route] = {
            count: bucket.count,
            byStatus: { ...bucket.byStatus },
            latencyMs: summarize(bucket.latencies),
            networkErrors: bucket.networkErrors,
            timeouts: bucket.timeouts,
            networkReasons: { ...bucket.networkReasons },
            networkSamples: bucket.networkSamples.map((sample) => ({ ...sample })),
          }
        }
        httpOut[phase] = routes
      }
      return {
        phases: phases.map((span) => ({ ...span })),
        http: httpOut,
        unexpected: [...unexpected.values()].map((entry) => ({ ...entry })),
        retries: [...retries.values()].map((entry) => ({ ...entry })),
        actions: structuredClone(actions),
        verdicts: { matrix: structuredClone(matrix), incoherent },
        submissions: {
          latencyMs: Object.fromEntries(
            Object.entries(submissionLatencies).map(([kind, values]) => [kind, summarize(values)]),
          ),
        },
        errors: errors.map((error) => ({ ...error })),
        warnings: [...warnings],
      }
    },
  }
}

export type Recorder = ReturnType<typeof createRecorder>
