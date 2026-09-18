# kata verify clean on a docs-only ADR spike (#61)

**Found while**: #61, "Spike: decidir o hosting do evento (ADR)" — a
timeboxed spike whose only deliverable was an ADR file and a tech-stack.md
pointer edit, no `back/src` changes at all.
**Where in kata**: `kata verify` (gate ladder step), no `kata-docs` MCP use.

## What

The task touched zero back application code, only `back/docs/adr/*.md` and
the repo-root `docs/tech-stack.md`. `kata verify` still ran (via the
pre-commit hook ladder) and correctly reported clean — it didn't false-flag
on the new markdown file living under `back/docs/`. No `kata-docs` MCP
lookups were needed since nothing kata-API-shaped was written.

## Why it matters

Confirms `kata verify`'s scope stays correctly limited to `src/` layout
rules and doesn't get confused by unrelated files under a package it
watches (`back/docs/adr/`). A plain "nothing to report" data point for the
signal-vs-overhead tracking this folder asks for.

## Metrics

kata-docs MCP: 0 queries (task was pure documentation, no kata API surface
touched). `kata verify` step: 0.67s, clean on first run. Full gate ladder
(typecheck + kata-verify + test across all 4 workspace packages): ~60s,
all green — friction was entirely from a fresh worktree needing
`pnpm install` and a hand-built `back/.env` (no repo/kata issue, just
first-run setup in an isolated worktree).
