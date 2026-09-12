# kata out of frame: #229 was front + design-canvas only

**Found while**: implementing-tasks for #229 (round-screen identity restyle)
**Where in kata**: n/a — `kata verify` only, as the standing gate

## What

The whole task (10 plan steps: Badge/Alert variants, RoundCountdown
a11y+className, the round-screen header/grid/states restyle, a Python
design-canvas generator function, and an e2e spec) touched only `front/`
and `docs/design/`. No back route, schema, DI wiring, or JWT/error surface
changed, so there was nothing to query `kata-docs` MCP about — zero
lookups made, zero avoidable guessing.

`kata verify --strict-coverage` still ran on every commit via the
pre-commit hook (mandatory gate ladder) even though `back/` had no diff.
It stayed fast and quiet every time: 0.7–0.95s, "no problems found (65
files checked)" on all 7 commits in this task.

## Why it matters

Confirms the front/design-only path through this workflow has no kata
friction at all — the gate is cheap enough that running it unconditionally
on every commit (rather than skipping when `back/` is untouched) costs
under a second and never produced a false positive here.

## Metrics

- kata-docs MCP queries: 0 (not applicable — no back surface touched)
- kata verify runs: 7 (one per commit), all green, ~0.8s average
- No kata-related turns or friction anywhere in the session
