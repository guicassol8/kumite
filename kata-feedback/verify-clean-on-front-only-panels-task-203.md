# kata verify clean on a front-only task that never touched back (#203)

**Found while**: #203 — collapsible/resizable panels for `/problem/$id` on
desktop (statement, editor, results band; react-resizable-panels v4;
localStorage persistence).
**Where in kata**: `kata verify --strict-coverage`, the pre-commit hook
ladder, `kata-docs` MCP.

## What

Ten commits, zero lines touched under `back/src/`, `back/drizzle/` or
any `.hurl` file — the plan (from `planning-tasks`) had already confirmed
this was entirely `front/`-scoped. `kata verify --strict-coverage` still
ran on every single commit (it's part of the shared `pnpm check`/pre-commit
ladder regardless of which package changed) and passed instantly every
time — "65 files checked", unchanged commit to commit, since nothing it
checks was ever modified.

`kata-docs` MCP was never queried: no DI, no JWT, no error-envelope, no
route/schema question ever came up, because none of that surface was in
play.

## Why it matters

Another data point (alongside `verify-clean-on-sse-debounce-task.md` and
similar entries) that `kata verify` imposes zero overhead on a task that
doesn't touch its surface — it isn't scoped to "did this commit change
back/", it just re-checks the whole `back/` tree every time, and that
re-check is cheap enough (well under a second) to not matter even across
ten commits of a front-only task.

## Metrics

- kata-docs queries: 0. Tokens spent on kata lookups: 0 — nothing in this
  task's surface (react-resizable-panels, Tailwind, localStorage,
  Playwright) is kata's concern.
- `kata verify` / hook friction: none. Every commit's `kata verify
  --strict-coverage` step in the pre-commit ladder finished in under a
  second and reported "no problems found" — the heaviest parts of each
  commit's gate ladder were `pnpm -r test` (back's own ~616 tests running
  unchanged, front's growing) and, once, a genuine bug in the task's own
  code (react-resizable-panels crashing when a Panel was conditionally
  added to an already-mounted Group) that `kata verify` correctly had
  nothing to say about, since it isn't a kata-shaped problem.
