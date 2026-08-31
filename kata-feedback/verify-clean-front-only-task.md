# kata verify: clean run on a front-only task

**Found while**: #12 (organizer problems list screen — front only, back untouched)
**Where in kata**: `kata verify --strict-coverage` (pre-commit hook)

## What

No kata-docs MCP lookups were needed this session (no back routes, DI, JWT,
or error-surface work). `kata verify --strict-coverage` ran automatically on
every commit via the pre-commit hook (6 commits) and stayed green throughout,
including on commits that only touched front i18n/JSON and Playwright
screenshot files — no false positives from files outside kata's own module
layout.

## Why it matters

Confirms `kata verify` doesn't impose overhead or noise on commits that
don't touch back code at all, even when the pre-commit hook runs it
unconditionally on every commit in a mixed-scope repo.

## Metrics

Zero kata-docs queries this session (0 tokens spent there) — task never
needed the framework's API surface. `kata verify` added ~0.6s per commit,
negligible against the ~30s `pnpm test` step in the same hook.

## Review-side confirmation (PR #87)

Re-ran the gate ladder from a clean review checkout of the same branch:
`kata verify --strict-coverage` reported **"no problems found (33 files
checked)"** and exited 0 in well under a second, on a branch whose diff
touches zero files under `back/`. Zero kata-docs MCP queries were needed
for the review either — the PR's kata surface area was genuinely nil, and
`kata verify` correctly said so instead of inventing work.

The one friction worth recording is not kata's: reproducing the front
evidence needed a Postgres, and the repo's `docker-compose.yml` pins the
host port (`5433:5432`), so a second worktree can't `docker compose up`
while the main checkout's db is running ("port is already allocated").
Worked around with a standalone container on 5434 + a `DATABASE_URL`
override in the worktree's `back/.env`. Nothing for kata to fix — noting
it because `docs/workflow.md` § Worktrees already anticipates port
collisions for 3000/5173 but not for the database.
