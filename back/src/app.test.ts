import { afterAll, describe, expect, it } from 'vitest'

import { app, modules } from './app'
import { k } from './context'
import { registeredRoutes } from './lib/registered-routes'
import { requireUser } from './middlewares/auth'

// Cross-module, process-level suite (#188), at src/ root like
// `auth-guards.test.ts`, `uuid-params.test.ts` and `request-limits.test.ts`:
// what the *application* registers, as opposed to what any one module does.
//
// Nothing here needs database state — every request either misses the router
// entirely or is answered by reflection over the module list — but importing
// `app` resolves the `db` singleton, so the socket has to be closed like in
// `request-limits.test.ts`.
const db = k.resolve('db')

afterAll(async () => {
  await db.$client.end()
})

const NIL_ID = '00000000-0000-0000-0000-000000000000'

// Guard on the guards. Every "no offenders" assertion below is a filter over
// `registeredRoutes(modules)`, and a filter over an empty list is empty: if
// the kata `__kata === 'route'` marker ever moves, this whole file would go
// green while asserting nothing at all. This is the one test that fails in
// that scenario.
describe('route reflection', () => {
  it('sees the real, populated route table', () => {
    expect(registeredRoutes(modules).length).toBeGreaterThan(40)
  })
})

// --- The kata-starter example module (#188) ---

// `POST /greetings` shipped to production straight out of `kata init`: public,
// unthrottled, and appending to a module-level `Map` that was never read from
// again and never pruned. 1000 unauthenticated curls all answered 200, and the
// first greeting created was still readable afterwards — nothing is evicted,
// so the heap only goes one way.
describe('the kata-starter greetings module is not part of this application', () => {
  it('does not answer POST /greetings, with a body that used to be accepted', async () => {
    // The body is deliberately *valid* against the old CreateGreetingBodySchema.
    // An empty request would 422 on validation and would also "not be 200",
    // which would let this pass while the route still existed. A payload the
    // old handler would have happily stored is what proves the route is gone
    // rather than merely picky.
    const res = await app.request('/greetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'not_found', message: 'Route not found' })
  })

  it('does not answer GET /greetings/:id either', async () => {
    const res = await app.request(`/greetings/${NIL_ID}`)

    expect(res.status).toBe(404)
    // The status alone does not discriminate here: the old handler already
    // answered 404 for a miss, and its store was empty on every fresh process.
    // What separates "the route does not exist" from "the handler found
    // nothing" is the message — kata's app-level `notFound` says
    // 'Route not found', the old handler said 'Greeting not found'.
    //
    // That couples this assertion to the wording of kata's error envelope. The
    // structural assertion below is the net that survives an upgrade changing
    // that wording.
    expect(await res.json()).toMatchObject({ message: 'Route not found' })
  })

  it('registers no route under /greetings at all', () => {
    const offenders = registeredRoutes(modules)
      .filter((route) => route.path.startsWith('/greetings'))
      .map((route) => `${route.method} ${route.path}`)

    expect(offenders).toEqual([])
  })
})

// --- The public surface is a closed list (#188) ---

// The finding behind #188 was not really "greetings leaks memory" — it was
// "a route nobody meant to ship was reachable by the whole internet and no
// test noticed". Pinning only the instance would let the next one in just as
// quietly, so the surface itself is the assertion.
//
// Same shape as `PASSWORD_CHANGE_EXEMPT` in `auth-guards.test.ts`: adding a
// line here is a deliberate act, because a line here is a route anyone on the
// internet can call without a token. Each of these is public on purpose —
// `GET /health` is the probe the deployment polls, the four `/auth` routes are
// how an account is obtained or recovered (they carry their own rate limits,
// #142), and `POST /bug-reports` is the floating button, reachable from the
// logged-out screens, throttled per IP (#145).
const PUBLIC_ROUTES = new Set([
  'GET /health',
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/request-password-reset',
  'POST /auth/complete-password-reset',
  'POST /bug-reports',
])

describe('unauthenticated route surface', () => {
  it('has no route outside the documented public list', () => {
    const offenders = registeredRoutes(modules)
      .filter((route) => !route.use?.includes(requireUser))
      .map((route) => `${route.method} ${route.path}`)
      .filter((key) => !PUBLIC_ROUTES.has(key))

    // Not `toHaveLength(0)`: the failure has to name the route that went out
    // without a guard, same reason as the guardrails in auth-guards.test.ts.
    expect(offenders).toEqual([])
  })

  it('keeps the public list honest — every entry is a real route that really is unguarded', () => {
    const publicRoutes = new Set(
      registeredRoutes(modules)
        .filter((route) => !route.use?.includes(requireUser))
        .map((route) => `${route.method} ${route.path}`),
    )

    // The reciprocal of the assertion above, and the reason it cannot rot:
    // a stale entry (a route renamed, deleted, or since put behind
    // `requireUser`) is dead weight that would silently excuse a *future*
    // route that happens to reuse the key.
    const stale = [...PUBLIC_ROUTES].filter((key) => !publicRoutes.has(key))

    expect(stale).toEqual([])
  })
})
