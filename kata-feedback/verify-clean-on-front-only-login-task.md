# kata verify clean on a front-only task with zero back diff (#191)

**Found while**: #191 — render the already-computed zod validation
messages under the login form's email/password fields (`FormMessage` was
imported but never used).
**Where in kata**: `kata verify --strict-coverage`, the pre-commit hook
ladder.

## What

The entire change touched two files, both under `front/` (`login.tsx`,
`login.test.tsx`); `back/` had zero diff. The pre-commit hook still ran
the full ladder (format → typecheck → `kata verify --strict-coverage` →
`pnpm -r test`, including the back suite) on the commit, since the ladder
is repo-wide rather than scoped to the changed package. `kata verify`
passed instantly ("no problems found, 65 files checked") with nothing to
resolve — there was no DI, no route, no middleware chain in the diff for
it to check, so this run is closer to a no-op confirmation than a real
signal for this task.

One friction point unrelated to `kata verify` itself: the worktree had no
`back/.env` yet (this being a from-scratch worktree resumed after a
VS Code crash), so `pnpm -r test` failed on missing `JWT_SECRET` before a
throwaway Postgres container and `.env` existed. Once a dedicated
container (port 5437) and `.env` were in place and migrated, the full
ladder (back 616 tests, front 672, blocks 51) passed clean on the first
real attempt.

## Why it matters

Confirms the gate ladder's cost is the same (full repo-wide `pnpm -r
test` + `kata verify`) regardless of whether the task actually touches
`back/` — a front-only, client-validation-only fix still pays for a full
back test run and a live Postgres. Not a kata bug, just a data point on
where the ladder's fixed cost comes from.

## Metrics

- kata-docs queries: 0. Tokens spent on kata lookups: 0 — nothing in this
  task touched the kata framework surface (no route, no DI, no schema).
- `kata verify` / hook friction: none from `kata verify` itself (instant,
  clean); the only setup friction was standing up the worktree's own
  Postgres + `.env`, which is a kumite worktree-convention cost, not a
  kata one.
