import { performance } from 'node:perf_hooks'

import { hc } from 'hono/client'

// Type-only: the typed client needs the app's shape, never its runtime (which
// would load ../config.ts and demand the back's own environment).
import type { AppType } from '../app'

import type { NetworkErrorDetail, Recorder } from './recorder'
import type { FetchLike } from './sse-client'

// Every request the harness makes goes through here (#136): timed until the
// end of the body, recorded by phase and route, bounded by the request
// timeout. The fetch is injectable so the in-process tests drive app.fetch.

function describeNetworkError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timeout'
    const code = (error as Error & { cause?: { code?: unknown } }).cause?.code
    return typeof code === 'string' ? code : error.message
  }
  return String(error)
}

function socketCounter(socket: unknown, key: 'bytesWritten' | 'bytesRead'): number | null {
  if (!socket || typeof socket !== 'object' || !(key in socket)) return null
  const value = (socket as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

/**
 * What a failed request can tell about itself (#138): the code (undici puts
 * it on `cause`), the message, whether it failed before any response
 * (`request`) or while reading the body (`body`), and the socket's byte
 * counters when undici attaches the socket to the error. A socket that had
 * already read bytes when a request failed before its own response had
 * carried earlier responses: it was a reused keep-alive socket.
 */
export function networkErrorDetail(
  error: unknown,
  stage: NetworkErrorDetail['stage'],
): NetworkErrorDetail {
  const reason = describeNetworkError(error)
  const cause =
    error instanceof Error && error.cause && typeof error.cause === 'object'
      ? (error.cause as { message?: unknown; socket?: unknown })
      : null
  const socket = cause?.socket
  const bytesRead = socketCounter(socket, 'bytesRead')
  return {
    reason,
    message:
      typeof cause?.message === 'string'
        ? cause.message
        : error instanceof Error
          ? error.message
          : String(error),
    stage,
    socketBytesWritten: socketCounter(socket, 'bytesWritten'),
    socketBytesRead: bytesRead,
    reusedSocket: bytesRead === null ? null : stage === 'request' && bytesRead > 0,
  }
}

// The detail of each error the transport rethrew, for the caller to decide
// on (the submitter's retry); a WeakMap, so the error itself is untouched.
const details = new WeakMap<object, NetworkErrorDetail>()

/** The detail recorded for an error `timedFetch` rethrew, if any. */
export function detailOf(error: unknown): NetworkErrorDetail | undefined {
  return error && typeof error === 'object' ? details.get(error) : undefined
}

function errorCodeOf(text: string): string | null {
  try {
    const body: unknown = JSON.parse(text)
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // not the envelope
  }
  return null
}

function describeRequest(input: string | URL | Request, init?: RequestInit) {
  if (input instanceof Request) return { method: input.method, url: input.url }
  return { method: init?.method ?? 'GET', url: String(input) }
}

export function createTransport({
  baseUrl,
  recorder,
  requestTimeoutMs,
  fetch = (input, init) => globalThis.fetch(input, init),
}: {
  baseUrl: string
  recorder: Pick<Recorder, 'recordHttp'>
  requestTimeoutMs: number
  fetch?: FetchLike
}) {
  /**
   * fetch, timed and recorded. Reads the whole body before returning (so the
   * latency is until the last byte) and hands back an equivalent Response. A
   * network error or a timeout is recorded and rethrown to the caller, who
   * decides whether its action failed.
   */
  const timedFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const { method, url } = describeRequest(input, init)
    const timeout = AbortSignal.timeout(requestTimeoutMs)
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    const started = performance.now()
    let stage: NetworkErrorDetail['stage'] = 'request'
    try {
      // hc calls fetch(url, init); a Request is unwrapped for completeness.
      const requestInit: RequestInit =
        input instanceof Request
          ? {
              method: input.method,
              headers: input.headers,
              body: input.body ? await input.text() : null,
              signal,
            }
          : { ...init, signal }
      const res = await fetch(url, requestInit)
      stage = 'body'
      const text = await res.text()
      recorder.recordHttp({
        method,
        url,
        status: res.status,
        errorCode: res.ok ? null : errorCodeOf(text),
        ms: performance.now() - started,
      })
      return new Response(res.status === 204 ? null : text, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      })
    } catch (error) {
      const detail = networkErrorDetail(error, stage)
      if (error && typeof error === 'object') details.set(error, detail)
      recorder.recordHttp({
        method,
        url,
        status: null,
        errorCode: null,
        ms: performance.now() - started,
        networkError: detail.reason,
        networkDetail: detail,
      })
      throw error
    }
  }

  return {
    baseUrl,
    timedFetch,
    /** The typed RPC client, as `token` (or anonymous), over timedFetch. */
    api: (token?: string) =>
      hc<AppType>(baseUrl, {
        fetch: timedFetch,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    /** The bare fetch, for /sse: its body never ends, so it is not timed here. */
    rawFetch: fetch,
  }
}

export type Transport = ReturnType<typeof createTransport>
export type Api = ReturnType<Transport['api']>

/** The ADR-0008 envelope's `error`, from a response whose body was not read yet. */
export async function readErrorCode(res: { text: () => Promise<string> }): Promise<string | null> {
  try {
    return errorCodeOf(await res.text())
  } catch {
    return null
  }
}
