# Multi-status `output` and a stacked `bodyLimit` both hold up against a live server; the 422 envelope is stable enough to assert on

**Found while**: review of PR #289 (#287 — hardening pré-evento: seed sem reset
em produção, limite de corpo nas rotas públicas, `/health` com banco, `db:reset`).
**Where in kata**: `defineRoute({ output: { 200, 503 } })`, `bodyLimit()` in
`createApp({ middlewares })` vs. a route's own `use:`, the validation-error
envelope, `kata verify --strict-coverage`.

## What

The implementation's own entry
(`task-287-app-level-bodylimit-and-a-503-on-health.md`) recorded two kata
observations from the *test* side. This review confirmed both against a real
server on a real Postgres, and adds a third.

1. **Multi-status `output` works end to end.** `output: { 200: HealthSchema,
   503: HealthSchema }` with `c.json(health, health.status === 'ok' ? 200 : 503)`
   served a validated `{"status":"degraded"}` with a real 503 in all three
   database states: Postgres paused (503 in ~503 ms, the route's own 500 ms
   timeout winning the race), Postgres stopped (503 in 4.5 ms, connection
   refused), Postgres back (200 in ~2 ms, no API restart needed).
2. **`bodyLimit` app-wide + route-level composes as hoped, over HTTP too.** A
   600 KB POST got 413 on `/auth/login`, `/auth/signup`,
   `/auth/request-password-reset`, `/auth/complete-password-reset` and
   `/bug-reports`, while the same body hit `/submissions`' stricter 256 KB
   first. A small body still reached the handler (401 bad credentials), so the
   app-level check is not swallowing legitimate traffic.
3. **The 422 envelope is stable enough to assert on (new).** kata answers a
   zod failure with `{"error":"validation_failed","issues":{"body":[{"path":
   "password","message":"String must contain at most 128 character(s)"}]}}`.
   That `issues.body[].path` is precise enough to pin an acceptance criterion
   at the HTTP level instead of stopping at `schema.safeParse`, which is what
   this review added to `src/request-limits.test.ts`. Worth knowing it is safe
   to depend on — or worth a doc note if it is *not* considered stable API.

## Why it matters

Observations 1 and 2 were inferences from unit tests; a reviewer would
otherwise have to re-derive them or read kata's source. Observation 3 changes
how acceptance criteria get pinned across this repo: "THE SYSTEM SHALL respond
422" can be tested as written rather than one layer below.

One contrast worth recording: the front consumes this multi-status route
through `hc` with no friction — `if (!res.ok) throw` narrows fine and
`pnpm -r typecheck` is green. That is the opposite of the repo's known
`res.status === 422` pain (comparing against a status kata does not put in the
typed union yields TS2367). Checked directly rather than assumed: a throwaway
`front/src` module comparing `res.status === 503` on this route compiles with
no error, so a status *declared* in `output` does land in the `hc` union, and
only the undeclared ones (kata's implicit 422) produce TS2367. That asymmetry
is the actual doc-worthy bit.

## Metrics

- kata-docs MCP: **not consulted — not available to this session** (no
  kata-docs tools exposed). Cost of the workaround: zero extra turns. Every
  kata question this review had (does a 503 in `output` really serve a 503?
  does a nested `bodyLimit` resolve to the smaller? what exactly is in the 422
  envelope?) was answered faster by `curl` against a running server than a doc
  lookup would have been — seconds per question, and the answer is evidence
  for the PR rather than a claim to trust.
- `kata verify --strict-coverage`: green twice (before and after the review's
  fixes), 66 files, ~0.7 s. No false positive on `src/db/reset.ts` (outside
  `modules/`) nor on the cross-module test at `src/` root.
- Turns lost to kata friction: 0.

## Suggested fix (optional)

Document that statuses declared in a route's `output` map are typed in the
`hc` client union (and undeclared ones are not) — that single line would
explain both the smooth experience here and the known 422 friction elsewhere.
