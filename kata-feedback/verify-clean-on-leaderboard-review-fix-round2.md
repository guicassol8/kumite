# kata verify clean across a third review-driven bug fix on #45's PR

**Found while**: `implementing-tasks` addressing a second "changes
requested" round on PR #110 (#45, leaderboard live grid) — same PR as
`verify-clean-on-leaderboard-review-fix.md`, a later review pass.
**Where in kata**: `kata verify --strict-coverage`.

## What

The review found a second real front-only bug, same class as the first:
`front/src/routes/leaderboard.tsx` fetched `rounds` once and never
invalidated it, so a round that just closed stayed invisible to
`lastClosedRound` until something else refetched the list. Fix was
entirely in `front/src/hooks/use-leaderboard-stream.ts` (add an
`onRoundChange` callback) and `leaderboard.tsx` (invalidate the rounds
query from it) — no `back/`, no schema, no `.hurl` touched. `pnpm verify`
ran twice this pass (once standalone, once inside the pre-commit hook
ladder): both `✓ kata verify: no problems found (46 files checked)`,
sub-second.

Zero `kata-docs` MCP queries again. The friction this pass came entirely
from kumite-side test infra, not kata: a stale back dev server (PID from
an earlier failed e2e attempt) held port 3010, and Playwright's
`webServer` health check defaults to port 3000 while this worktree's
`back/.env` overrides `PORT=3010` — the config only picks that up from
the *shell* env, not the dotenv file the back process reads, so
`PORT=3010 ORGANIZER_EMAIL=... ORGANIZER_PASSWORD=... pnpm exec
playwright test e2e/leaderboard.spec.ts` (run from `front/`, not through
`pnpm --filter ... e2e --`) was needed to actually exercise the fix live.
None of that is a kata surface — flagging only because it cost real turns
figuring out and is worth remembering for the next worktree-based e2e run
in this repo.

## Why it matters

Third data point (with `verify-clean-on-leaderboard-review-fix.md` and
`verify-clean-on-sse-debounce-task.md`) that a front-only fix against an
already-mirrored SSE event contract costs zero kata-docs round-trips and
zero `kata verify` friction, even across repeated review cycles on the
same PR.

## Metrics

- kata-docs queries: 0.
- `kata verify` runs: 2, both clean, both sub-second.
- Turns lost to kata itself: 0. Turns lost to non-kata test infra
  (stale port + Playwright webServer port mismatch with this worktree's
  `PORT=3010` override): ~4-5, worth a mental note for future worktree
  e2e runs but not something to fix here.
