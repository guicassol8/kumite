# kata verify/hurl clean on the second nullable→backfill→NOT NULL migration (#238)

**Found while**: review of PR #268 (issue #238, `accepted_at` tiebreak fix)
**Where in kata**: `kata verify --strict-coverage`, `hurl`, drizzle-kit migrate

## What

PR #268 reuses the exact nullable-column → backfill migration → `NOT NULL`
shape that #176 introduced (documented in
`task-176-implementing-verify-silent-on-drizzle-mcp-never-consulted.md`):
add `accepted_at` nullable (0018), backfill it from `created_at` with a
guarded `DO $$ ... RAISE EXCEPTION` orphan check (0019), then `SET NOT NULL`
and rebuild the affected index (0020). `kata verify --strict-coverage`
passed clean (65 files) on the service/schema changes either way — as
before, it has no opinion on the migration SQL itself, correctness of the
backfill guard, or whether the new column is read consistently across the
three call sites (`submissions.service.ts`, `ranking.service.ts`) that had
to change together. `pnpm db:migrate` applied 0018-0020 against the
worktree's throwaway Postgres with only benign "already exists, skipping"
notices (schema/table already present from an earlier migrate). `hurl`
passed 15/15 files, 321 requests, on the first run — no volume wipe needed
this time, just a manual `TRUNCATE ... RESTART IDENTITY CASCADE` + `db:seed`
before booting `dev:back`, since the DB had been through the vitest suite
first.

## Why it matters

Second data point that the nullable→backfill→NOT NULL pattern is now a
reusable, low-friction shape in this codebase for adding a required
timestamp column with historical backfill — kata's migration tooling
(drizzle-kit, not kata itself, but adjacent) didn't fight it either time.
Confirms `kata verify` remains blind to cross-file semantic consistency
(three files had to agree on renaming a field from `createdAt` to
`acceptedAt` in `ScoringRow`/`BestEntry`/`getBestSubmission`); the test
suite, not verify, is what catches a missed call site — visible here in how
thorough the PR's own test diff is (deliberately divergent `createdAt` vs.
`acceptedAt` fixtures to prove the read path actually moved).

## Metrics

Zero kata-docs MCP lookups this session — nothing in the diff touched a
kata idiom unfamiliar from #176 (no new DI, JWT, or error-surface code), so
there was no doc question to ask. All gate-ladder time went to the
worktree's throwaway-Postgres dance (truncate, seed, start `dev:back`,
export `ORGANIZER_*`/`HURL_HOST`) rather than kata itself.

## Suggested fix

None. Filed as a clean confirmation, per the "attempt every review" rule —
this is the second review to land on the same migration shape without
kata-side friction.
