# Task #178 implementation: front-only fix, `kata verify` ran 5× and said nothing

**Found while**: implementing #178 (editor remounts and loses the
participant's blocks when the UI language changes)
**Where in kata**: `kata verify` (via the repo's pre-commit / Stop hook gate
ladder), `kata-docs` MCP (not used)

## What

Nothing in this task touched kata: the whole change is React
(`front/src/hooks/use-workspace-autosave.ts`,
`front/src/routes/problem.$id.tsx`) plus vitest and Playwright specs. The
back was never edited and no route, DI binding, JWT surface or error shape
moved.

Two plain observations, no bug:

1. **Zero `kata-docs` lookups, again.** The MCP server was never queried —
   there was no kata question to ask. This is the fourth consecutive
   front-only planning/implementation entry in this folder with the same
   shape (#178, #179, #180, #155), which is itself a signal: for a
   full-stack product, a good share of the tasks never come near the
   framework, and the harness cost of kata tooling on those tasks should
   stay near zero. It currently does.

2. **`kata verify` ran on every commit and cost ~0.8s each time.** Five
   commits × ~0.8s of `kata verify --strict-coverage` over 65 back files
   that this branch does not modify. It is correctly silent (no false
   positive, no false negative), and 0.8s is cheap enough that gating it
   behind "back/ actually changed" would be an optimization, not a fix. The
   expensive part of the same ladder is `pnpm -r test` at ~95s per commit,
   which is kumite's own, not kata's.

## Why it matters

Nothing to act on in kata. Recording it as the "clean run" signal the
folder asks for: on a front-only task the framework's tooling neither
helped nor got in the way, and `kata verify` stayed fast and quiet on an
untouched back.

## Metrics

- kata-docs MCP calls: **0**. Tokens spent on kata lookups: **0** of the
  task's total.
- `kata verify` invocations: 5 (one per commit, via the Stop/pre-commit
  ladder), ~0.8s each, all green, all on unchanged back code.
- Extra turns caused by kata or its tooling: **0**. Every turn lost in this
  task went to the front e2e suite, where three pre-existing specs
  (`problem.spec.ts`, `problem-layout.spec.ts`) sit at 28–35s against
  Playwright's 30s per-test budget and fail at a different line on each
  run — reproduced identically on the base commit with the fix reverted, so
  kumite's own, not kata's.

## Suggested fix (optional)

None.
