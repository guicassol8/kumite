# `raw()`'s strict-mode body validation hangs forever against a never-ending stream

**Found while**: planning #38 (SSE event channel for kumite's live rounds)
**Where in kata**: `raw()` output contracts / output validation (ADR-0009, ADR-0024)

## What

`raw(contentType, schema)` is documented (guide/routes-schemas.md, ADR-0024
§4) as the way to declare a non-JSON response contract. In `strict` mode —
the dev/test/CI default — a declared status's body is checked via
`response.clone().text()`, which buffers the *whole* response before
comparing it to the schema.

That's fine for a CSV export or a download: the body is finite and
`.text()` eventually resolves. It's fatal for a genuinely long-lived
stream — an SSE channel kept open with a heartbeat, by design, for as long
as the client stays connected. `.clone().text()` on that body never
resolves (the stream isn't finished until the client disconnects), so
*every* request to such a route — from `kata verify`'s own request-driven
checks, from a Vitest `testClient(app)` call, from `pnpm hurl`, from a
plain dev-server curl — hangs indefinitely in `strict` mode. There is no
way to opt just this one route out: ADR-0009 lists a per-route
`outputValidation` override as a deferred follow-up, not something that
exists today; the only app-wide knobs are `strict`/`log`/`off` on
`createApp`, and flipping the whole app to `log`/`off` just to unblock one
streaming route is a large, unwanted blast-radius change.

The only working escape hatch, confirmed by re-reading ADR-0024 §3 and
`reference/define-route.md`'s "Which status a return maps to" section, is
to leave the success status **undeclared** in the route's `output` map
(e.g. `output: {}`), so `entryForStatus` never finds an entry for it and
the `Response` passes through completely unvalidated — the same mechanism
already used elsewhere in this codebase for the 401/403 a middleware
short-circuit produces without ever appearing in `output`. It works, but
it means a legitimately-declared, RPC-typed contract (the entire point of
ADR-0024) is unavailable for this class of route, and nothing in the docs
calls that out — `raw()`'s own guide page reads as if it's the right tool
for exactly this case ("a CSV export, a plain-text file, a download... a
route that serves something else") without distinguishing "something else,
eventually finite" from "something else, intentionally infinite."

## Why it matters

SSE / long-polling / any chunked-and-never-closing response is a normal
shape for a realtime feature (kumite's live-round sync, and later its
leaderboard, both need it — tech-stack.md already commits to "SSE via Hono
streaming" as the realtime direction). Anyone reaching for `raw()` to
declare that contract, following the guide as written, will ship a route
that silently deadlocks the first time anything in `strict` mode touches
it — a bad failure mode to discover via a hung CI job or a frozen `kata
verify` run rather than a doc warning at the point of use.

## Metrics

Two `search_docs` calls (`raw output-validation`-flavored queries) plus
three `read_doc` calls (`guide/routes-schemas.md`'s raw() section,
ADR-0024 in full, ADR-0009 in full) settled this — maybe 15-20% of this
planning session's total tool calls, but it fully paid for itself: without
reading ADR-0024 §3-4 closely, the natural first attempt would have been
`output: raw('text/event-stream', z.string())`, which compiles and looks
correct, and only reveals the hang empirically (a stuck test run) rather
than up front. The docs *do* contain the answer (the unified
`entryForStatus`/undeclared-status behavior is documented, just not
cross-referenced from the `raw()` section itself) — this is a
"the docs don't connect two true facts for you" gap, not a missing fact.

## Suggested fix

- Add a callout to the `raw()` section of `guide/routes-schemas.md`
  ("Non-JSON responses: `raw()`") naming this specifically: a `raw()`
  entry whose `Response` body never completes (SSE, long-poll, an
  unbounded chunked stream) will hang `strict`-mode validation, and the
  fix today is to leave that status undeclared instead of using `raw()`
  for it.
- Bumps the priority, in ADR-0009's own Follow-ups list, of a per-route
  `outputValidation` override — it would let a route declare `raw()` for
  documentation/typing purposes while opting only its own body-check into
  `log`/`off`, without touching the app-wide default.
