# kata verify / hurl clean on review of PR #108 (#44)

**Found while**: `reviewing-tasks` on PR #108 (ranking → SSE debounce, #44).
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`.

## What

Re-ran the full gate ladder from a review worktree (not the one the
implementation was authored in): `pnpm -r typecheck`, `pnpm verify`,
`pnpm -r test` (304 back / 246 front / 40 blocks, all green) and
`pnpm hurl` all passed clean against the diff as merged into the branch.
No kata-docs MCP query was needed to review this diff — the SSE/ranking
module shapes were legible from the code and existing ADRs alone.

The only friction was kumite-side, not kata-side: this worktree's `back/.env`
points `DATABASE_URL`/`PORT` at a dedicated throwaway Postgres container
(5435) from an earlier session, so `pnpm hurl`'s default `host=http://localhost:3000`
needed an explicit `HURL_HOST` override, and the container had stale rows
from a prior run that made `auth/signup` 400 until truncated + reseeded.
Not a kata gap — the per-worktree throwaway-DB convention here predates
this task — just recording it since it cost a couple of extra round-trips
before hurl went green.

## Why it matters

Another clean-verify data point for a pub-sub/debounce shape (module-level
dirty flag, background tick) reviewed independently of the authoring
session — consistent with `verify-clean-on-sse-debounce-task.md`'s finding
from the implementation side.

## Metrics

- kata-docs queries: 0.
- Extra turns from environment friction: ~2 (finding the right `HURL_HOST`,
  then truncating/reseeding the throwaway DB) — unrelated to kata itself.
