# Clean kata verify + hurl run, zero docs-mcp lookups

**Found while**: implementing #184 (round ranking phantom-team filter)
**Where in kata**: `kata verify --strict-coverage`, hurl runner, DI/route surface (read-only, no changes)

## What

Pure observation, nothing to report as a bug. The whole implementation loop
(9 plan steps: a service-level filter, a unit test rewrite, an SSE test
addition, a hurl rewrite, i18n + two React route edits, a Playwright spec)
never touched the kata-docs MCP server — no route/DI/JWT/error-surface
question came up that wasn't answerable from reading the existing
`ranking.service.ts` / `ranking.route.ts` code directly. `kata verify
--strict-coverage` ran clean on every commit (via the pre-commit hook) with
no false positives, and `pnpm hurl` on the touched module (`ranking.hurl`)
passed on the first real run once the module's own DB/env setup was in
place.

## Why it matters

Confirms the "no docs lookup" cost is zero here — nothing to weigh against
a lookup that didn't happen. The one bit of friction was environmental, not
kata-specific: `kata verify`/`hurl`/vitest all share the worktree's Postgres,
and each `pnpm check` run inside the commit hook truncates `users`, wiping
the seeded organizer — the hurl module run afterwards needed a `db:seed`
re-run before `ORGANIZER_EMAIL`/`ORGANIZER_PASSWORD` would authenticate again.
Already covered by an existing memory note (kumite-e2e-reseed-after-every-commit),
not a kata-framework issue.

## Metrics

- kata-docs MCP queries: 0 (out of budget for this task ~= 0% spent there).
- `kata verify` invocations: ~4 (once per back-touching commit via the
  pre-commit hook), all green, sub-second each.
- `pnpm hurl` (ranking module only, then full suite once): 2 runs, both
  green after the DB reset above; no lint/type false positives encountered.
