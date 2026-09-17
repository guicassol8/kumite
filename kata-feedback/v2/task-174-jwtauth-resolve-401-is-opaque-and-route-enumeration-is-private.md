# `jwtAuth.resolve` can only fail one way, and enumerating routes needs a private marker

**Found while**: kumite #174 — deactivating a user did not drop sessions
already issued (the only P0 of the 2026-09-10 bug hunt). Fix: make the
`resolve` of `requireUser` refuse `active: false`.
**Where in kata**: `@katajs-framework/core/jwt` — `jwtAuth({ resolve })` and
`guard()`; plus whatever `defineRoute` stamps as `__kata: 'route'`.

## What

Two observations, both from the same task. Neither blocked it — the task
shipped clean — but both shaped the design in ways worth recording.

**1. `resolve` has exactly one failure mode.** kata gives a consumer two
places to refuse an authenticated request:

- `resolve` returning `undefined` → a 401 with kata's fixed body. Runs for
  every route that uses the middleware, so it is *fail-closed*: a route added
  tomorrow is covered without touching anything. But the error code is not
  customizable — "no such user", "account banned" and "token expired" are
  indistinguishable to the client.
- `guard()` → 403 with an error code of your choosing, but wired per route in
  `use:`, so it is *fail-open*: a route that forgets it is simply unguarded.

#174's acceptance asked for 401 and the mechanism is a moderation lever that
must not fail open, so `resolve` was the only real option, and we paid the
opacity: the front cannot tell a ban from an expired token, so it lands on
`/login` through the session-expired path. That is an acceptable outcome here,
but it was a forced choice, not a preference. A third option — `resolve`
returning something like `{ reject: { status, code } }` instead of bare
`undefined` — would have given fail-closed *and* a distinguishable code.

Related: kumite's ADR-0004 already documents the mirror-image cost of the
other branch (`requirePasswordUpToDate` is a `guard()`, fails open, and is
kept honest only by a hand-written guardrail test).

**2. There is no public way to enumerate registered routes.** Both guardrail
tests in `back/src/auth-guards.test.ts` — the #143 one and the new #174 sweep
that walks all 42 authenticated routes and asserts a banned token gets 401 on
each — work by filtering module exports on
`(value as { __kata?: string }).__kata === 'route'`. That double-underscore
marker looks private, and there is no documented alternative. Any consumer
that wants to assert "every authenticated route has middleware X" has to reach
for the same thing, and it would break silently on a kata refactor.

## Why it matters

The fail-open/fail-closed split is the whole reason #174 existed as a P0: the
neighbouring guard (`mustChangePassword`) is a per-route `guard()`, and the
convention held only because someone had written a test to enforce it. For a
security-shaped check, the framework pushing you toward `resolve` is right —
it just costs you the error code. Meanwhile the only tool for auditing
middleware coverage (route enumeration) is an undocumented field.

`kata verify --strict-coverage` stayed green throughout and correctly saw the
middleware chain as unchanged — the fix only touched the body of `resolve`,
not any `use:`. Right call, no false positive.

## Metrics

- **kata-docs MCP lookups: zero.** Not because the server was down (it was not
  consulted at all) — the two kata surfaces in play were already documented
  inside kumite: the `resolve`/`guard()` tradeoff in ADR-0004 and the
  ADR-0011 short-circuit note in `sse.route.ts`. Prior kumite ADRs paid for
  themselves here; kata's own docs were not needed.
- **Cost of the kata surface within the task: near zero.** No turn was spent
  chasing a framework answer. The time went to the DB/worktree setup and the
  gate ladder.
- **`kata verify`**: ~0.7s per run, green on all three commits. No friction.
- **Gate ladder friction, non-kata**: each commit's pre-commit hook runs the
  full 1089-test suite, ~100-125s. Two of the three commits exceeded a 120s
  tool timeout and had to be backgrounded. Not kata's doing — recorded because
  it is the dominant per-commit cost of this workflow.
- **hurl**: 308 requests, 15 files, ~20s, green first try. The only friction
  is the known one, already reported: the suite is not re-runnable without a
  truncate + seed, and `ORGANIZER_*` must be exported in the shell rather than
  read from `back/.env`.

## Suggested fix (optional)

1. Let `resolve` reject with a status/code instead of only `undefined` — the
   fail-closed path would stop being a single anonymous 401.
2. Expose a supported route-enumeration helper (`app.routes()`, or document
   `__kata`) so consumer-side middleware-coverage tests are not built on a
   private marker.
