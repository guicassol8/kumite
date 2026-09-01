# Guard short-circuit order (requireUser → requireRole) held up under an independent hurl run

**Found while**: reviewing PR #99 (#27 — organizer role guard)
**Where in kata**: `@katajs-framework/core/jwt` (`jwtAuth`, `requireRole`), route `use:` chaining

## What

Re-ran the PR's own evidence from scratch, independently, in a disposable
worktree + throwaway Postgres container rather than trusting the author's
pasted output: `pnpm -r typecheck`, `pnpm verify --strict-coverage`,
`pnpm -r test` (199 back / 227 front / 40 blocks, all green), then a fresh
`db:migrate` + `db:seed` + `pnpm hurl` against a freshly booted server. All
matched the PR's claimed numbers exactly (81 hurl requests, 7 files, 100%).

Specifically exercised the ordering claim in the new
`back/src/middlewares/auth.ts` comment — `requireOrganizer` assumes
`requireUser` already ran and filled `currentUser`, so `use: [requireUser,
requireOrganizer]` order matters. The hurl file's steps 0c/0d hit
`/organizer/problems` with no token (expect 401) and then with a
participant token (expect 403) before ever calling with a valid organizer
token — both passed, confirming `jwtAuth` really does short-circuit before
`requireRole` runs, on a real HTTP round-trip rather than just the in-process
`app.request()` unit suite.

## Why it matters

This is the same short-circuit-ordering class of behavior as the earlier
`middleware-short-circuits-confirmed-413-beats-401.md` finding (body-limit
vs. auth) — worth confirming it generalizes to a third middleware
(`requireRole`) stacked after `jwtAuth`, since `use:` array order isn't
type-enforced and a reversed order would be a silent 403-instead-of-401 bug
that no schema would catch.

## Metrics

Reviewer-side kata-docs usage: **zero** — nothing needed re-verifying beyond
what #27's own implementation had already confirmed (`jwt-docs-worth-the-tokens.md`),
so this review spent its budget on *running* the evidence rather than
re-reading docs. Total review overhead: one throwaway Postgres container
(`docker run` + `db:migrate` + `db:seed` + `pnpm start` + `pnpm hurl`), maybe
6 extra tool round-trips versus trusting the PR's pasted output, for a
categorically stronger guarantee (independently reproduced, not just
re-read).

## Suggested fix

None — this is a confirmation entry, not a gap.
