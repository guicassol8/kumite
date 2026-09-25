import { afterAll, describe, expect, it, vi } from 'vitest'

// Pinned before `./app` (and so `./config`) is imported: loadEnvFile() never
// overrides a variable that is already set, and vitest isolates env per file.
// A front origin that is *not* the dev literal proves it is APP_BASE_URL that
// drives the allowlist, not the hard-coded localhost entry.
const FRONT = vi.hoisted(() => {
  const origin = 'https://front.kumite.test'
  process.env.APP_BASE_URL = origin
  return origin
})

import { app } from './app'
import { APP_MAX_BODY_BYTES, DEV_FRONT_ORIGIN } from './config'
import { k } from './context'

// Cross-module suite (#273), at src/ root like request-limits.test.ts: the
// app-level cors() answers only the front's own origin (APP_BASE_URL) and the
// local dev front. None of these requests needs database state, but importing
// `app` resolves the `db` singleton, so its socket is closed like elsewhere.
const db = k.resolve('db')

afterAll(async () => {
  await db.$client.end()
})

const EVIL = 'https://evil.example'
const ACAO = 'Access-Control-Allow-Origin'

function get(path: string, origin?: string) {
  return app.request(path, { headers: origin === undefined ? {} : { Origin: origin } })
}

function preflight(path: string, origin: string) {
  return app.request(path, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })
}

describe('CORS allowlist on a simple request', () => {
  it('echoes APP_BASE_URL back and varies on Origin', async () => {
    const res = await get('/health', FRONT)
    expect(res.status).toBe(200)
    expect(res.headers.get(ACAO)).toBe(FRONT)
    expect(res.headers.get('Vary') ?? '').toMatch(/Origin/i)
  })

  it('echoes the local dev front back', async () => {
    const res = await get('/health', DEV_FRONT_ORIGIN)
    expect(res.headers.get(ACAO)).toBe('http://localhost:5173')
  })

  it('emits no Access-Control-Allow-Origin for any other origin', async () => {
    const res = await get('/health', EVIL)
    // The request itself is still served: CORS is enforced by the browser,
    // the server only withholds the header that would let it read the answer.
    expect(res.status).toBe(200)
    expect(res.headers.get(ACAO)).toBeNull()
  })

  it('emits no Access-Control-Allow-Origin to an opaque `null` origin', async () => {
    const res = await get('/health', 'null')
    expect(res.headers.get(ACAO)).toBeNull()
  })

  it('serves a non-browser client (no Origin, as curl and hurl send) untouched', async () => {
    const res = await get('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get(ACAO)).toBeNull()
  })
})

// The synthetic OPTIONS route kata registers for an app-level cors()
// (ADR-0020) must apply the same allowlist as the real response.
describe('CORS allowlist on a preflight', () => {
  it('allows the front, with the Authorization header the SPA sends', async () => {
    const res = await preflight('/auth/login', FRONT)
    expect(res.status).toBe(204)
    expect(res.headers.get(ACAO)).toBe(FRONT)
    expect(res.headers.get('Access-Control-Allow-Headers') ?? '').toMatch(/authorization/i)
  })

  it('emits no Access-Control-Allow-Origin to another origin', async () => {
    const res = await preflight('/auth/login', EVIL)
    expect(res.headers.get(ACAO)).toBeNull()
  })
})

// The front has to *read* these to react (the expired-session flow on a 401,
// #189), so the allowed origin must survive into error responses too.
describe('CORS headers on error responses from an allowed origin', () => {
  it('keeps Access-Control-Allow-Origin on a 401', async () => {
    const res = await get('/me', FRONT)
    expect(res.status).toBe(401)
    expect(res.headers.get(ACAO)).toBe(FRONT)
  })

  it('keeps Access-Control-Allow-Origin on a 413 from the app-wide body limit', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { Origin: FRONT, 'Content-Type': 'application/json' },
      body: 'x'.repeat(APP_MAX_BODY_BYTES + 1),
    })
    expect(res.status).toBe(413)
    expect(res.headers.get(ACAO)).toBe(FRONT)
  })
})
