# Heaviest-kata-surface task yet needed zero kata-docs MCP queries

**Found while**: #36 (organizer rounds API — create/open/extend/close, 7
routes, DI via `c.get('db')`, `requireUser`/`requireOrganizer` middleware
chain, `defineRoute`/`defineMiddleware`, `.hurl` E2E, `kata verify
--strict-coverage`)
**Where in kata**: `defineRoute` output-schema/error-code conventions,
`kata verify --strict-coverage`, `pnpm hurl`

## What

This is the most kata-surface-heavy module implemented so far in this repo
(7 routes across 3 verbs, 5 branchy service functions each returning a
discriminated-union result, every branch mapped to a status code via
`c.error`), and it needed **zero** `kata-docs` MCP lookups. The existing
sibling modules (`problems.route.ts` / `problems.service.ts`,
`submissions.service.ts` for the transaction pattern) fully covered every
convention question that came up: how `output: { 2xx, 4xx, ... }` maps to
`c.error(code, message, { status })`, why 401/403 short-circuits from
middleware aren't declared in `output` (ADR-0011, called out in a comment
in both `problems.route.ts` and now `rounds.route.ts`), and the
discriminated-union-result-from-service / switch-in-route-to-map-errors
shape.

`kata verify --strict-coverage` stayed green across every one of the 8
incremental commits (schema → reap/reads → create → update → open →
extend → close → routes+wiring), including the commit that first
registered 7 new routes with `use: [requireUser, requireOrganizer]` — no
"unresolvable middleware in a chain" false positive, no coverage gap
flagged on the switch statements that fall through without a `default`
case (relying on the response-type union being exhaustive rather than a
literal default branch, same style already used in
`problems.route.ts`'s `publishProblemRoute`).

## Why it matters

Suggests that for a kata consumer with an established internal pattern
library (sibling modules following the same `AGENTS.md` layout), the
marginal value of `kata-docs` drops to near zero once 3-4 modules exist —
copying the shape of an existing route/service pair answered every
question a genuinely new module (rounds, not previously scaffolded) could
raise. The framework's own docs never entered the loop this time.

## Metrics

Zero kata-docs queries, zero tokens spent there, against a task whose
total back-end work was 8 commits / ~700 lines across schema+service+
route+hurl. `kata verify --strict-coverage` added negligible time per
commit (consistently ~0.6s in the pre-commit hook, same as reported in
`verify-clean-front-only-task.md` for an unrelated front-only task).
`pnpm hurl` (8 module files, 115 requests total including the new 34-request
`rounds.hurl`) ran in ~1.4s against a throwaway Postgres container with no
flakiness across two full runs.

## Suggested fix

None — this is a "the pattern-matching approach works, kata-docs wasn't
needed" data point, not a gap. Worth revisiting if a future module needs a
framework capability with **no** existing kumite precedent (e.g. the first
use of a websocket/streaming route, or a DI slot shape not yet used) — that
is the case where kata-docs would likely earn its cost back.
