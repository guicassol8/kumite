import type { InferResponseType } from 'hono'

import { api } from './api'

export type SessionUser = InferResponseType<typeof api.me.$get, 200>

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

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

// Idempotent: the first call kicks off `GET /me` and caches its promise, so
// concurrent and later callers (route guards, the root bootstrap) all await
// the same hydration instead of each firing their own request.
export function ensureHydrated(): Promise<void> {
  if (hydration) return hydration

  // Already resolved by setSession/clearSession (e.g. right after login) —
  // nothing to hydrate, so skip straight to a cached no-op.
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

  setState({ ...state, status: 'loading' })
  hydration = (async () => {
    const res = await api.me.$get()
    if (res.status === 200) {
      const user = await res.json()
      setState({ status: 'authenticated', user, token })
    } else {
      removeStoredToken()
      setState({ status: 'anonymous', user: null, token: null })
    }
  })()

  return hydration
}
