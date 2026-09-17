# Review of #141: verify clean, and hurl needed a full volume wipe again

**Found while**: reviewing PR #141 (#53 — remove the organizer-triggered
password reset, add public `POST /auth/request-password-reset`, build
`/organizer/users`). Companion to the same cycle's planning and
implementation entries
(`task-53-planning-route-removal-zero-docs-lookups.md`,
`task-53-implementation-hurl-host-port-split-and-reset-tax.md`).

**Where in kata**: `kata verify --strict-coverage`, hurl integration.

## What

Three observations, none blocking.

**1. `kata verify` clean, and it stayed honest across a route deletion.**
`✓ kata verify: no problems found (59 files checked)` in 0.75s. The diff
under review *removed* a route (`POST /organizer/users/:id/reset-password`)
and the `NoContentSchema` that only it used, and *added* one
(`POST /auth/request-password-reset`) — the exact shape where a stale
route registry or an orphaned schema export tends to survive. Nothing was
left dangling, and `grep` for the removed path across `back/src`,
`front/src` and `front/e2e` came back empty. Whether verify would have
caught an orphan here wasn't exercised (there wasn't one), so this is a
"no false positive on a deletion-heavy diff" data point, not proof of
detection.

**2. hurl again needed `docker compose down -v` to be runnable at all.**
Same recurring cost recorded in
`hurl-and-unit-tests-fight-over-one-database.md` and half a dozen sibling
entries. `password-reset.hurl` documents this itself in a header comment
("rerunning this file locally without resetting the db fails the first
signup on the second run"), which is honest but is the framework asking
each consumer to write the same disclaimer. From a cold volume the run is
fast and total: 14 files, 263 requests, 5.5s, 100%. The setup around it —
`down -v` → `up -d` → wait for `pg_isready` → `db:migrate` → `db:seed` →
boot the server → export `HURL_HOST`/`ORGANIZER_*` — is six steps and the
bulk of the review's back-evidence wall-clock.

**3. `HURL_HOST`/`PORT` split bit again, exactly as predicted.**
The implementation entry flagged that `back/.env`'s `PORT` doesn't reach
the hurl script's shell. Reviewing in the same worktree (`PORT=3053`), the
run needed `HURL_HOST=http://localhost:3053` passed explicitly. Knowing
the trap in advance turned it into zero lost turns — which is the entry
paying for itself, and also evidence the sharp edge is still there.

## Metrics

- **kata-docs MCP queries: 0.** The review read a diff and ran gates; no
  kata API surface was in question. Consistent with the rest of this
  cycle — planning and implementation both reported zero lookups too, so
  #53 end-to-end cost nothing in docs round-trips.
- Gate ladder, this worktree: `pnpm -r typecheck` ~15s ·
  `pnpm verify` 0.75s · `pnpm -r test` ~85s (824 tests across 3 packages) ·
  hurl 5.5s once the DB was rebuilt.
- The Stop/pre-commit hook ladder ran the full suite twice more (once per
  review commit), ~84s each. That is the dominant cost of a two-commit
  review fix, and it is kumite's hook config rather than kata's doing.

## Suggested fix (optional)

For (2), the ask that keeps recurring across these entries: a
`kata hurl --reset-db` (or a documented "truncate + reseed" preamble hook)
so each consumer stops hand-rolling the wipe and stops writing the same
"not re-runnable" comment at the top of its `.hurl` files.

For (3), let the hurl script default `host` from the same `PORT` the app
reads, rather than from an independent `HURL_HOST`.
