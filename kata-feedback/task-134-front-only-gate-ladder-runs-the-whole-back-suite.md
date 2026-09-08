# A front-only task still pays the full back gate ladder (and a DB) on every commit

**Found while**: kumite #134 — Vercel Web Analytics + Speed Insights,
`front/` only (5 commits, zero lines of `back/` touched)
**Where in kata**: not kata code itself — `kata verify` as invoked by the
repo's Stop/pre-commit hook ladder, plus the DB coupling of `back`'s vitest
suite

## What

Nothing in this task touched `back/`, kata, hurl or any kata API surface.
**Zero `kata-docs` lookups were made, and none were needed** — the whole
task lived in `front/src/{components,lib,routes}` and `front/e2e`.

`kata verify` itself was clean and fast on every one of the five commits
(0.7–1.7s each). The friction was around it: each commit runs the full
ladder (`format → typecheck → kata verify → back test → front test`),
~90–115s a commit, of which ~48s is `back`'s vitest suite. That suite
needs a live Postgres and a parsed env, so a front-only worktree cannot
commit at all until it has provisioned its own database:

- The first commit attempt failed with 16 of 23 back test files erroring
  at import on `JWT_SECRET` (env parse), because the fresh worktree had
  no `back/.env`.
- Getting to green meant `.env` + `back/.env` + `front/.env`, a dedicated
  compose Postgres on a free port, and `db:migrate` — all so that a change
  to a React component could be committed.

This is a kumite/harness composition issue as much as a kata one, but the
kata-shaped part is real: `kata verify` is cheap and package-scoped, while
the test surface kata's module layout encourages (services that import a
configured `env` at module load, and integration tests that hit the real
DB) makes *any* commit in the repo transitively require a running database.

## Why it matters

The cost is paid per commit, not per task, so TDD's "commit each green
step" and the hook ladder pull against each other: five small steps cost
~8 minutes of gates for a change no back test can even observe. On a
front-only or docs-only branch the entire back half of the ladder is
guaranteed-unchanged work. It also makes worktree onboarding a
prerequisite for touching *anything* — see the sibling reports
`hurl-and-unit-tests-fight-over-one-database.md` and
`verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md`, which
hit adjacent edges of the same coupling.

## Metrics

- `kata-docs` MCP queries: **0**. Docs read: 0. Tokens spent on kata
  lookups: ~0 of the task's total — correctly, since the task was front-only.
- `kata verify`: 5 runs, all clean, 0.7s–1.7s each. Never surfaced anything,
  never got in the way.
- Gate ladder per commit: ~90–115s wall clock × 5 commits ≈ 8 min, ~48s of
  each run being `back test` (422 tests) that no commit in this branch could
  affect.
- One wasted commit round-trip (~40s) spent discovering that the failure was
  a missing `back/.env`, not the change under test — the error surfaces as
  16 unrelated test files failing at import, which reads like a real
  regression before you look closely.

## Suggested fix (optional)

Nothing kata *must* change. Two ideas, in order of how much they'd help:

1. A clearer failure when `env` fails to parse at import time: right now a
   missing `JWT_SECRET` presents as N test files failing with a stack in
   `notifications.service.ts`, not as "env invalid: JWT_SECRET required".
   A single fail-fast line naming the missing keys would have saved the
   round-trip.
2. Nothing for kata on the ladder scoping itself — that's kumite's hook
   config to fix (skip `back test` when `git diff --cached` touches no
   `back/` path). Recording it here only because the DB coupling that makes
   it expensive is a property of the kata-shaped module layout.

## Review addendum (PR #147, review stage)

The review of this PR reproduced the same shape from the other side, so the
numbers are worth recording next to the implementation ones:

- **`kata-docs` MCP queries: 0 again.** Nothing in the diff touched a kata
  surface, and the review never needed one. Zero tokens spent on lookups,
  correctly.
- **`kata verify --strict-coverage`: 2 runs, both clean** (60 files, no
  problems), ~1s each. It has yet to say anything about a front-only branch —
  which is the right answer, just not a free one.
- **Cost of the review's gate ladder: ~2×90s**, of which `back test` (422
  tests, ~60s) is again the dominant term on a branch that changes no `back/`
  file. One extra manual `pnpm -r test` was run purely to paste trimmed
  output as PR evidence.
- **New data point — evidence production also needs the database.** Producing
  the front's visual walkthrough meant provisioning this worktree's Postgres,
  running `db:migrate` *and* `db:seed`, and signing a participant up through
  the API, so that a screenshot of a React route could be taken. The
  telemetry under test never touches the DB. That is the same coupling the
  body of this report describes, now paid a second time at review.

Nothing here asks kata to change beyond suggestion (1) above; recording it so
the per-commit and per-review cost of the DB coupling is visible as a trend
rather than a one-off complaint.
