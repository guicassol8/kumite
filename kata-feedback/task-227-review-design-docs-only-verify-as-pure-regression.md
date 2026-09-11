# Design-docs-only PR: `kata verify` ran as pure regression, zero docs lookups

**Found while**: reviewing-tasks for PR #244 (issue #227, o vão do símbolo e o
gerador do logo)
**Where in kata**: `kata verify --strict-coverage`

## What

The PR touches only `docs/design/` — Python/Node generators, versioned WOFF2
fonts, SVG/PNG assets and prose. Not one byte of `back/` or `front/` source.
`pnpm verify` still ran as part of the gate ladder and reported
`✓ kata verify: no problems found (65 files checked)` in 0.79s against the
unchanged back.

No `kata-docs` MCP query was made, and none would have helped: every question
this review had to answer was about rasterization (does `stroke-width: 3`
inflate the path enough to eat the gap?), font provenance (do the versioned
WOFF2 faces really carry the weights the `@font-face` block declares?) and
generator determinism (does re-running `make_logo.py` / `export.sh` /
`build.py` / `shot.mjs` reproduce the committed bytes?). Pillow, fontTools and
`git status` answered all of it.

Worth noting the file count: 65 back files checked, same as recent reviews —
`verify` correctly treated this as a no-op rather than finding spurious work.

## Why it matters

Second data point (after `review-115-verify-clean-front-only.md`) that
`kata verify` is cheap enough to leave in the gate ladder unconditionally,
even on a PR with no back surface at all. Sub-second on a no-op means there's
no argument for conditionally skipping it, and the repo's `pnpm check` stays a
single unconditional command.

Also a small counterpoint to the "always consult kata-docs first" reflex: the
useful signal here came from the *project's own* new guard
(`docs/design/canvas/generate/check_mark.py`, which measures the rendered PNG
rather than the SVG). A framework-level verifier has nothing to say about a
design-asset regression, and correctly said nothing — no false positives from
`--strict-coverage` on the Python/Node files that landed alongside.

## Metrics

kata-docs round-trips: 0 (the MCP server was not queried; no dead ends, no
latency cost). Review total: ~30 tool calls. `kata verify`: 0.79s of a 108s
gate ladder (0.7%) — the 90s test run dominates. No lookup would have paid off.

Environment friction was entirely kumite-side, not kata-side: the shared
Postgres on 5433 was down and ports 5439–5447 were held by five other
worktrees, so this review booted its own compose stack on 5451. `kata verify`
needed no database at all and ran before any of that — a genuine plus for a
static verifier.
