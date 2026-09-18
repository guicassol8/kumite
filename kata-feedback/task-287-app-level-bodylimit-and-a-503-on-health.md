# App-level `bodyLimit` stacks cleanly under a stricter route-level one; a 503 on `/health` was the first multi-status output on a route with no `use:`

**Found while**: #287 — hardening batch (seed no longer resets in prod, body
ceilings on the public routes, `/health` probing the database, `pnpm db:reset`).
**Where in kata**: `bodyLimit()` in `createApp({ middlewares })`, multi-status
`output` on a route with no middleware.

## What

Two small kata-surface observations, both positive.

1. `bodyLimit({ maxSize: 512KB })` registered app-wide and
   `bodyLimit({ maxSize: 256KB })` in `/submissions`' own `use:` compose the way
   one hopes: the app-level check runs first, the route-level one after, and
   the smaller limit is what a 300 KB body hits (413 from the route, not a 201).
   No doc says so explicitly; the middleware ADR (0017) implies it and a
   cross-module test (`src/request-limits.test.ts`) now pins it.
2. `output: { 200: HealthSchema, 503: HealthSchema }` on a route with no
   `use:` at all works exactly like the guarded ones, and `kata verify
   --strict-coverage` had nothing to say about a service that takes a `ping`
   function instead of the `db` (the route still reads `c.get('db')`, which is
   what the DI coverage rule looks at).

## Why it matters

Both are the kind of "does it do the obvious thing" question an agent would
otherwise have to answer by reading kata's source. Recording the yes saves the
next task the round trip.

## Metrics

- kata-docs MCP: not consulted (disabled in this machine's
  `settings.local.json`; the answers above came from `back/src` and one
  test each).
- `kata verify`: PostToolUse hook ran it on each back edit, always green,
  ~2 s. No false positive on the new `src/db/reset.ts` (outside modules/, like
  `seed.ts`) nor on the cross-module test at `src/` root.
- Turns lost to kata friction: 0.

## Suggested fix (optional)

A one-line note in the middleware guide that nested `bodyLimit`s resolve to
the smallest would close observation 1 for good.
