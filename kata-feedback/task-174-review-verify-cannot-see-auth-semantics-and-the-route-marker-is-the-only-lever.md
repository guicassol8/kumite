# `kata verify` is blind to auth *semantics*, and the private route marker was the only way to review them

**Found while**: reviewing kumite PR #235 / issue #174 — the fix that makes
`requireUser`'s `resolve` refuse `active: false`. Reviewer-side companion to
[`task-174-jwtauth-resolve-401-is-opaque-and-route-enumeration-is-private.md`](./task-174-jwtauth-resolve-401-is-opaque-and-route-enumeration-is-private.md),
which reports the same surfaces from the implementer's side.
**Where in kata**: `kata verify --strict-coverage`; `@katajs-framework/core/jwt`
(`jwtAuth({ resolve })`); whatever `defineRoute` stamps as `__kata: 'route'`.

## What

Two observations, both from trying to *verify* someone else's auth change
rather than write one.

**1. `--strict-coverage` passed the whole time — including with the bug put
back.** The diff under review changed one line inside the `resolve` of the
single `jwtAuth` middleware in the app: the chokepoint every authenticated
route goes through. To test the guardrail I reverted that line by hand and
re-ran the ladder. `kata verify --strict-coverage` reported
`no problems found (65 files checked)` both with the fix and with the P0
restored, because what it proves is *wiring* — that a middleware chain
resolves, that routes declare `input`/`output` — not what the chain decides.
That is a fair scope for a static check and I am not asking it to grow one;
the point is what it means for a reviewer: on the most security-sensitive
file in the codebase, kata's own verifier is not a signal either way, and
100% of the confidence has to come from the consumer's own tests.

**2. Reviewing the fix meant leaning on the same undocumented marker.** The
only evidence that the fix is *complete* — that no authenticated route was
missed — is kumite's sweep test, which enumerates routes by filtering
`modules` for objects carrying `__kata: 'route'` and then checking
`route.use?.includes(requireUser)`. With the fix reverted that sweep named
**42** authenticated routes leaking to a banned token (`GET /me -> 200` with
`"active": false` in the body, `GET /teams -> 200`, `POST /submissions -> 422`,
`GET /sse -> 200`); with the fix, all 42 answer 401. That negative control is
the single most valuable artifact of this review, and it exists only because
kumite reached into a private field. A supported read-only introspection API
— "give me the registered routes and their middleware" — would turn a
hand-rolled guardrail into a supported one, for exactly the class of check
(fail-open middleware conventions, auth coverage) that consumers cannot get
from `verify`.

## Why it matters

A consumer auditing "is every authenticated route actually guarded?" today
has two options: an allowlist that rots, or a private marker that can break
on any kata minor. kumite has both patterns in `src/auth-guards.test.ts`
already, and both hang off `__kata: 'route'`. If that field is renamed, the
test does not fail loudly with "kata changed" — `registeredRoutes()` returns
`[]` and every sweep passes vacuously. kumite defends against that with an
`expect(authenticated.length).toBeGreaterThan(0)` line, which is a workaround
for a missing API, not a design.

## Metrics

- **kata-docs MCP queries this review: zero.** Nothing was looked up and
  nothing was missing. The framework surfaces in play (`resolve` returning
  `undefined` → 401, `guard()` → custom code) were already explained in the
  PR's ADR-0004 update and in the middleware's own comments; the implementer
  had paid that lookup cost and written it down.
- **Round-trips spent on kata itself: ~2 of ~35 tool calls** (`pnpm verify`
  twice — once per direction of the negative control). Everything else was
  kumite code, the DB, hurl and the test suite.
- **Where the review time actually went**: standing up an isolated stack
  (Postgres 5443, API 3043) so the suites would not collide with two other
  worktrees. `pnpm verify` itself is fast (65 files, sub-second) and never
  got in the way. `hurl` ran 308 requests across 15 files in 6.1s with
  `--jobs 1` — no friction there either.
- **Did kata help this task?** Neutral: it cost nothing and told nothing.
  The verifier's silence was correct but uninformative, and the one thing a
  reviewer genuinely needed from the framework — route introspection — had
  to be improvised.
