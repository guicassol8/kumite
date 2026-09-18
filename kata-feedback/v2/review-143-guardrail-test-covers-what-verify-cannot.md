# Review of #143: the guardrail test covers exactly the gap `verify` can't

**Found while**: reviewing PR #157 (#143 — organizer-driven password reset with
step-up, plus a `must_change_password` block on 39 authenticated routes)
**Where in kata**: `kata verify --strict-coverage`, `guard()`, the hurl runner

## What

`kata verify --strict-coverage` came back clean on all 61 files, including the
new `POST /organizer/users/:id/reset-password` that declares
`output: { 200, 403, 404 }` while its 401/403 middleware short-circuits stay
undeclared (framework ADR-0011). No false positive, no coaxing.

The interesting part is what verify is structurally blind to, and how the PR
paid for it. A per-route `use:` list is **fail-open for routes added later** —
forget `requirePasswordUpToDate` on a route someone adds next month and
nothing complains: not tsc, not verify, not the test suite. The implementation
answered with a guardrail test (`back/src/auth-guards.test.ts`) that exports
the module list from `app.ts`, walks every registered route object by its
`__kata === 'route'` marker, and asserts that every route carrying
`requireUser` also carries `requirePasswordUpToDate` unless it is on a
two-entry allowlist.

Worth recording because that test could itself have been fail-open: if kata
ever renames the internal `__kata` marker, `registeredRoutes()` silently
returns `[]` and the main assertion passes vacuously. The PR anticipated it —
a second test asserts the two exempt routes are *present* in the walked set,
which fails loudly if the walk ever comes back empty. That is the right shape,
but it is a shape every kata consumer wiring a cross-cutting guard has to
reinvent, on top of an undocumented internal marker.

Confirmed in the review: verify clean, 517 back unit tests green, 14/14 hurl
files (293 requests) green, 50 Playwright specs green.

## Why it matters

The gap is the absence of any "apply this middleware to every route matching
X, and fail the build when one is missing" affordance — a default `use:` at
module or app level, or a declarative assertion helper. Every consumer that
adds an authorization dimension across an existing route set pays the same
tax twice: once wiring N routes by hand, once building a bespoke guardrail
test against an internal marker (`__kata === 'route'`) that is not part of any
documented public surface. If that marker changes, consumer guardrail tests
break in the least visible way possible.

This is the second #143 entry to land on the same point — the implementation
entry (`task-143-implement-verify-clean-guard-per-route-scaled.md`) raised the
fail-open list; this one adds that the workaround depends on an undocumented
internal.

## Metrics

- **kata-docs MCP lookups this review: zero.** Nothing in the diff needed a
  doc round-trip — `guard()`, `defineMiddleware` and the `output` declaration
  rules were all legible from the surrounding kumite code and the PR's own
  ADR-0004. Cost of not querying: nothing found later that contradicted it.
- **Review token/turn cost attributable to kata**: effectively nil. The kata
  surface (verify + hurl) was ~3 of ~25 tool calls.
- **Friction, non-kata but recurring**: `pnpm hurl` defaults
  `host` to `localhost:3000`, so a review in a worktree on `PORT=3011` gets 14
  connection-refused failures before you remember `HURL_HOST`. Third review in
  a row to hit this (see `task-53-implementation-hurl-host-port-split-and-reset-tax.md`).
  A `.env`-aware default, or reading `PORT`, would remove it.
- **DB reset tax, again**: the hurl suite is not re-runnable without a full
  truncate + reseed, and my first attempt truncated the obvious tables but not
  `event_config` — which made `teams.hurl` and `event-config.hurl` fail with
  stale `maxTeamSize=6` assertions that look exactly like a real regression.
  Cost: one full extra hurl cycle to diagnose. A `hurl:reset` script that owns
  the complete table list would pay for itself.

## Suggested fix (optional)

1. A supported way to declare route-set-wide middleware (module-level default
   `use:`, or a `verify` rule like "every route with middleware A must also
   have B"), so the fail-open list stops being the consumer's problem.
2. Failing that, make the route marker a documented, stable public API (an
   exported `isRoute()` predicate would do), so guardrail tests like this one
   don't rest on an internal string.
3. Make the hurl runner default `host` from `PORT`/`.env` instead of a
   hardcoded 3000.
