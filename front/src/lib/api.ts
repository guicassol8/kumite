import type { AppType } from '@kumite/back'
import { hc } from 'hono/client'

import { authHeader, clearSession } from './session'

// Detects "the token expired mid-use": a 401 on a request that carried our
// own Authorization header. A 401 without that header (e.g. bad login
// credentials) is a normal API response, not a session drop — this is what
// tells the two apart without decoding the JWT's `exp` client-side.
export const authFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  const hadAuthHeader = new Headers(init?.headers).has('Authorization')
  if (res.status === 401 && hadAuthHeader) {
    clearSession('expired')
  }
  return res
}

// The typed RPC client. `AppType` is a type-only import — zero runtime coupling
// with the back; the contract (paths, inputs, outputs, status codes) is checked
// by the compiler. If the back changes a schema, `pnpm typecheck` breaks here.
export const api = hc<AppType>(import.meta.env.VITE_API_URL ?? 'http://localhost:3000', {
  headers: () => authHeader(),
  fetch: authFetch,
})
