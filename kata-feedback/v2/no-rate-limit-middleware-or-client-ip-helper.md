# No rate-limit middleware, and no first-class client IP

**Found while**: planning-tasks for #142 (Rate limit e paridade de tempo em
`POST /auth/request-password-reset`)
**Where in kata**: `@katajs-framework/core` 0.4.2 public surface —
`dist/index.d.ts` (middleware exports) and `dist/context-*.d.ts`
(`RouteContext`)

## What

Two adjacent gaps, found together while planning per-email/per-IP throttling
on a public anonymous route.

**1. Kata ships no rate-limit middleware.** The complete middleware surface in
0.4.2 is `bodyLimit`, `cors`, `secureHeaders` and `fromHonoTransform` (plus
`REQUEST_ID_HEADER`). Anti-abuse is entirely the consumer's problem. That is a
defensible scope decision — rate limiting needs a storage choice kata can't
make — but it's notable that `bodyLimit` and `secureHeaders` *are* in scope, so
a reader reasonably expects the third member of that family to be there too.
kumite now has two hand-rolled throttles built independently and differently:
`acquireSubmissionSlot` (process-local `Map`, #21) and, from this plan, a
Postgres-backed sliding window (#142).

**2. There is no first-class way to read the client IP.** `RouteContext` gives
`c.raw` (the Hono `Context`), so a consumer that needs the caller's address has
to reach past kata into Hono and then into the adapter — in kumite's case
`getConnInfo` from `@hono/node-server/conninfo`, a dependency of the *server
adapter*, not of kata. Worse, the correct answer depends on deployment: behind
kumite's Caddy `reverse_proxy`, the trustworthy value is the **rightmost**
`X-Forwarded-For` entry (the one the proxy appended); the leftmost, which is
what most examples use, is attacker-controlled. Every kata app that ever needs
an IP — for throttling, audit logging, or abuse triage — has to rediscover that
distinction on its own, and getting it backwards silently produces a limiter
that any client bypasses by sending its own `X-Forwarded-For`.

Related, and possibly the smaller/cheaper fix: `requestLogger` in kumite and
kata's own `REQUEST_ID_HEADER`/`RequestLogFields` surface already sit exactly
where a `clientIp` would be most useful.

## Why it matters

The IP one is a security footgun, not just a convenience gap. A rate limiter is
the one feature where reading the *wrong* field doesn't fail loudly — it just
doesn't work, and nothing in tests or `kata verify` can tell the difference,
because both readings type-check and both return a plausible string. A
framework-level helper that encodes "how many proxies do you trust" as an
explicit config would turn a silent security bug into a configuration decision
the consumer has to make on purpose.

The rate-limit one is milder: kumite is happy to own its own throttle, and the
storage decision genuinely belongs to the app. But if kata ever does ship one,
the useful shape is a `use:`-level middleware that takes a key extractor and a
store interface, rather than a batteries-included implementation — the two
kumite throttles differ in storage but agree exactly on that shape.

## Metrics

Two framework questions, both raised because kumite had never needed either
before, and neither answerable from kumite's own source. kata-docs MCP was
unavailable for the fifth consecutive session (see
`kata-docs-mcp-connect-timeout-during-planning.md`), so both were answered by
grepping the installed `.d.ts` in the pnpm store: one `grep` over
`dist/index.d.ts` for the middleware exports, one over `dist/context-*.d.ts`
for `raw: hono.Context`. ~2 turns, negligible tokens against a ~25-call
planning session, and version-exact for the pinned 0.4.2 — which a docs query
would not have guaranteed. Cost of the gap itself is not in the lookup; it's in
the plan carrying a new `back/src/lib/client-ip.ts` plus its own unit tests for
XFF parsing that arguably shouldn't be kumite's code to own or test.

## Suggested fix (optional)

Smallest useful step, in order of value per effort:

1. A `clientIp(c, { trustedProxies: number })` helper exported from
   `@katajs-framework/core`, counting from the right of `X-Forwarded-For` and
   falling back to the adapter's `getConnInfo` — the config forces the
   deployment question to be answered explicitly instead of guessed.
2. Document the leftmost-vs-rightmost XFF trap wherever `secureHeaders` and
   `bodyLimit` are documented, since that's where someone hardening a route
   will be reading.
3. Optionally, a `rateLimit({ key, store, limit, window })` middleware with a
   `store` interface and an in-memory default — leaving Postgres/Redis stores
   to consumers.
