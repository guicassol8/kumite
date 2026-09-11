import type { InferResponseType } from 'hono'

import { api } from './api'

export type SessionUser = InferResponseType<typeof api.me.$get, 200>

// 'error' is hydration giving up (#179): the token is still there, we just
// could not reach `/me`. It is deliberately NOT 'anonymous' — a network blip
// must never look like a logout, and the root renders a retry card over it.
export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error'

export type SessionState = {
  status: SessionStatus
  user: SessionUser | null
  token: string | null
  reason?: 'manual' | 'expired'
}

const TOKEN_KEY = 'kumite-token'

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function persistToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // localStorage may be unavailable (private mode, quota, disabled) — the
    // session still works in-memory for this tab.
  }
}

function removeStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // see persistToken
  }
}

let state: SessionState = { status: 'idle', user: null, token: readStoredToken() }
const listeners = new Set<() => void>()

function setState(next: SessionState): void {
  state = next
  for (const listener of listeners) listener()
}

export function getState(): SessionState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSession(user: SessionUser, token: string): void {
  persistToken(token)
  setState({ status: 'authenticated', user, token })
}

export function clearSession(reason: 'manual' | 'expired'): void {
  removeStoredToken()
  setState({ status: 'anonymous', user: null, token: null, reason })
}

export function authHeader(): Record<string, string> {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {}
}

let hydration: Promise<void> | null = null

// Backoff before attempt 1, 2 and 3 — the first one goes out immediately. A
// venue's wifi blip and a back restart both settle well inside 2s; more
// attempts would only stretch how long the screen stays blank.
const HYDRATION_BACKOFF_MS = [0, 500, 1500]

// Per attempt, not for the whole cycle. Without it a proxy that accepts the
// connection and never answers hangs `/me` forever, which is the same stuck
// loading screen by another route.
const HYDRATION_TIMEOUT_MS = 8_000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 'retry' covers both a rejected request (network down, timeout) and any
// non-auth status: a 502/503 from a back that is restarting must keep the
// token, or a 30s deploy would log the whole auditorium out for real.
type HydrationOutcome = 'done' | 'retry'

async function attemptHydration(token: string): Promise<HydrationOutcome> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HYDRATION_TIMEOUT_MS)
  try {
    const res = await api.me.$get({}, { init: { signal: controller.signal } })
    // `meRoute` declares only `output: PublicUserSchema`, so `res.status` is
    // the literal 200 and comparing it to 401 is a TS2367. The back is right;
    // the client is the one that has to widen (#174).
    const status: number = res.status
    if (status === 200) {
      const user = await res.json()
      setState({ status: 'authenticated', user, token })
      return 'done'
    }
    if (status === 401 || status === 403) {
      // `authFetch` (api.ts) already dropped the session on a 401 carrying our
      // Authorization header. Clearing it a second time would fire the root's
      // redirect twice and nest `redirect=/login?…` into itself.
      if (state.status !== 'anonymous') clearSession('expired')
      return 'done'
    }
    return 'retry'
  } catch {
    return 'retry'
  } finally {
    clearTimeout(timeout)
  }
}

// Never rejects. Exhausting the attempts parks the session in 'error' with the
// token intact, which is what the root's retry card acts on.
async function runHydration(token: string): Promise<void> {
  for (const [attempt, backoff] of HYDRATION_BACKOFF_MS.entries()) {
    if (attempt > 0) await delay(backoff)
    if ((await attemptHydration(token)) === 'done') return
  }
  setState({ ...state, status: 'error' })
}

// Idempotent: the first call kicks off `GET /me` and caches its promise, so
// concurrent and later callers (route guards, the root bootstrap) all await
// the same hydration instead of each firing their own request.
export function ensureHydrated(): Promise<void> {
  if (hydration) return hydration

  // Already resolved by setSession/clearSession (e.g. right after login) —
  // nothing to hydrate, so skip straight to a cached no-op. 'error' is
  // deliberately absent: that one has to reach the fetch again.
  if (state.status === 'authenticated' || state.status === 'anonymous') {
    hydration = Promise.resolve()
    return hydration
  }

  const token = state.token
  if (!token) {
    setState({ status: 'anonymous', user: null, token: null })
    hydration = Promise.resolve()
    return hydration
  }

  // Retrying out of 'error' keeps that status for the whole cycle on purpose:
  // the root paints the retry card on 'error', and dropping to 'loading' would
  // unmount it, flash the route underneath for two seconds and throw away the
  // button's own "Tentando…" state (#179).
  if (state.status !== 'error') setState({ ...state, status: 'loading' })
  const run = runHydration(token).then(() => {
    // The bug this fixes (#179): a failed hydration used to stay cached, so
    // every later caller awaited the same dead promise and only F5 got out.
    // Dropping the memo is what makes the next call try again — and it has to
    // happen after the assignment below, which the microtask guarantees.
    if (state.status === 'error') hydration = null
  })
  hydration = run

  return run
}

// What the retry button calls. A fresh cycle of attempts, in place — no
// `window.location.reload()`, since "the user should not need F5" is the
// whole point.
export function retryHydration(): Promise<void> {
  hydration = null
  // Forces the fetch path even from a status `ensureHydrated` would
  // short-circuit — the caller is asking for a fresh `/me`, not for a cached
  // answer. 'error' is the one status left alone, so the card stays mounted
  // for the whole cycle (see ensureHydrated).
  if (state.status !== 'error') setState({ ...state, status: 'loading' })
  return ensureHydrated()
}
