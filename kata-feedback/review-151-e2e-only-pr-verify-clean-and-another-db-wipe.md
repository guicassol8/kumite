# Reviewing an e2e-only PR: `kata verify` clean and structurally blind, plus a fifth DB-wipe sighting

**Found while**: review of PR #151 (issue #149 — reapontar as specs e2e que
navegavam para `/problem`)
**Where in kata**: `kata verify --strict-coverage`; nothing else. Zero
`kata-docs` MCP queries.

## What

The PR touches `front/e2e/**` only — five Playwright specs plus a new helper
(`front/e2e/support/editor-fixture.ts`). No back code, no routes, no schemas.

`kata verify` ran clean on every invocation (60 files, ~0.7s) and had nothing
to say, which is correct: there is no kata surface in the diff. Worth recording
because the review *did* produce a real finding, and it sat squarely in the
blind spot: the shared fixture guarded only its first HTTP step (organizer
login) and let the next two (`POST /organizer/problems`, `POST
/organizer/rounds`) return an undefined id, which then travelled as the literal
string `undefined` into a 30×3s retry loop — a ~90s failure naming the wrong
endpoint. That is a test-infrastructure defect in code that calls a kata API
over HTTP, so no amount of `kata verify` on `back/src` could see it. Not a gap
kata should close; just a note on where the tool's coverage ends when a task is
all client-side.

The second half is a re-sighting, not a new finding. The back vitest suite
truncates the shared Postgres, and the e2e specs need a seeded organizer, so
the review loop was: `pnpm -r test` → truncate → re-seed → e2e → commit →
pre-commit runs `pnpm -r test` → truncate again. I re-seeded three times in one
review for a PR that changes no back code.

## Why it matters

Two independent consumers of one database, with the commit hook interleaving
them — the same shape already filed four times
(`hurl-and-unit-tests-fight-over-one-database.md`,
`task-134-front-only-gate-ladder-runs-the-whole-back-suite.md`,
`verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md`,
`task-149-front-only-gate-ladder-runs-back-suite-that-wipes-the-e2e-db.md`).
This is the fifth, and the first from the *review* side rather than the
implementation side, which means the cost is paid twice per task: once while
writing, once while verifying.

The task's actual blocker was kumite's own (#150 — a spec that fails mid-run
leaves its round `open` with `closes_at` 30 minutes ahead, poisoning the
single-open-round slot). I reproduced it exactly during the full-suite run:
`round-screen.spec.ts` failed and left `Rodada Detalhe E2E 1788908065081` open
with 20 minutes to go, which is what made two of the PR's own specs fail with
`another_round_open`. Nothing to do with kata.

## Metrics

- `kata-docs` MCP queries: **0**. Nothing in the diff was kata-shaped; no
  lookup could have paid for itself, so the MCP cost this review nothing and
  contributed nothing. Correct outcome for a front-only PR, recorded so the
  zero-lookup cases stay visible next to the ones that needed five.
- `kata verify`: 3 runs (2 standalone, 1 via pre-commit), 60 files, ~0.7s each,
  always clean, 0 findings. The review's one code finding was outside its
  scope by construction.
- Gate ladder per commit: **114s**, of which back vitest is **67s** — spent
  entirely on code the PR never touches, and the part that wipes the database
  the PR's own evidence needs.
- Re-seeds forced by the wipe: **3**.
- E2E wall-clock: full suite **4.5 min** (33 passed / 9 failed / 1 skipped /
  6 not run, on a freshly migrated+seeded DB); the five specs under review
  alone, with the round slot free, **27–39s for 12 tests**. The spread is the
  fixture's open-round retry waiting out the round `db:seed` leaves open for
  about a minute — working as designed, and visible in the wall-clock.
- Unrelated friction, recorded for honesty: the machine rebooted mid-review.
  The git worktree survived; the compose container and dev servers did not, so
  Postgres had to be restarted and re-migrated before the ladder could resume.

## Suggested fix (optional)

Nothing for kata. The actionable item is kumite-side and already stated in the
four prior entries: scope the pre-commit ladder to the packages a commit
actually touches, or give the e2e suite a database the back unit suite does not
truncate. Filing the fifth sighting mainly to record that the pattern now costs
a task twice — implementation *and* review.
