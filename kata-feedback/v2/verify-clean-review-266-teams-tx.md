# kata verify / hurl clean on review of PR #266 (#192)

**Found while**: `reviewing-tasks` on PR #266 (teams write-path transactions +
clamp, #192).
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`.

## What

Reviewed a diff that adds two `db.transaction` blocks plus a
`pg_advisory_xact_lock` critical section to `teams.service.ts` (mirroring
the existing idiom in `password-reset.service.ts`). `kata verify
--strict-coverage` passed clean on the transactional code with no
unresolved-middleware or coverage-gap warnings — the framework's static
checks don't seem to choke on `db.transaction(async (tx) => …)` wrapping a
service function's whole body and returning its result, which was the one
shape I expected might trip a coverage heuristic (early-return branches
inside the callback). No kata-docs MCP query was needed: the transaction
idiom was already established elsewhere in the codebase, so this was a
"match existing precedent" review, not an API lookup.

`pnpm hurl` needed the usual local ritual before it went green (15/15,
321 requests): kill the stale dev server by port, `TRUNCATE` the full
table list including `event_config`, `db:seed`, restart the server, then
export `ORGANIZER_EMAIL`/`ORGANIZER_PASSWORD`/`HURL_HOST` in the same
shell invocation. First run without that sequence failed 9/15 files at
request 1 with 422s on `/auth/login` — the signature of a stale/dirty DB,
not a regression, per prior sessions' notes.

## Why it matters

Another data point that kata's static checks handle transactional service
functions and advisory-lock critical sections without special-casing —
useful to know before reaching for `// kata:ignore`-style suppressions on
similar future PRs.

## Metrics

- kata-docs queries: 0 (existing in-repo precedent was sufficient).
- Extra turns from environment friction: ~3 (stale dev server on the port,
  first hurl run against non-fresh DB, re-discovering the exact truncate
  list) — all kumite-side ritual, not a kata gap.
