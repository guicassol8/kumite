# Task #230 (implementing): front-only, kata out of frame

**Found while**: implementing #230 (404/error shells, og:image, manifest, `<html lang>`)
**Where in kata**: n/a — no kata-docs MCP lookups this session

## What

The whole task lived in `front/` (index.html, i18n, TanStack Router, a Vite
plugin, e2e) plus `docs/design/` (a Python SVG/PNG generator, unrelated to
kata). Zero back routes, schemas, or DI touched, so there was nothing to ask
`kata-docs` about — the tool never came up.

`kata verify --strict-coverage` still ran on every commit via the pre-commit
hook (13 commits total for this task) since the hook runs repo-wide
regardless of what changed. Every run: `no problems found (65 files
checked)`, sub-second, no friction, no false positive.

## Why it matters

Confirms `kata verify`'s cost on a front-only change stays negligible (well
under a second per commit here) and doesn't create pressure to skip commits
or batch them to dodge the hook — same shape as the other "kata out of
frame" entries logged for pure-front tasks.

## Metrics

- kata-docs MCP queries: 0.
- `kata verify` invocations: 13 (one per commit), all green, ~0.75s each per
  the hook's own timing output.
- No turns spent on kata docs lookups or dead ends.
