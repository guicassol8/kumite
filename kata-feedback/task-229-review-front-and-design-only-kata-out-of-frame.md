# kata out of frame: review of #229/PR #253 was front + design-canvas only

**Found while**: reviewing-tasks for PR #253 (fixes #229)
**Where in kata**: n/a — `kata verify` only, as the standing gate on the fix commit

## What

Review Stage 2 covered a diff touching only `front/` and `docs/design/`
(round screen restyle, Badge/Alert primitives, i18n, an e2e spec, and two
canvas artboards). One genuine finding surfaced — the "hard" difficulty
badge used the filled `destructive` Badge variant instead of the outline
style the issue's Acceptance line and the design mockup (screens2.py) both
call for — but it was a Tailwind/JSX styling bug, nothing to do with kata.
Fixing it and committing still ran `kata verify --strict-coverage` via the
pre-commit hook (mandatory gate ladder) with zero back-end diff: 0.80s,
"no problems found (65 files checked)".

## Why it matters

Second data point (after the implementation-side report on the same
issue) that a front/design-only PR incurs zero kata-docs lookups and
negligible `kata verify` overhead through both the implement and review
stages — the gate ladder's cost stays flat regardless of whether `back/`
changed.

## Metrics

- kata-docs MCP queries: 0 (no back surface touched by the review or its fix)
- kata verify runs during review: 1 (on the fix commit), green, 0.80s
- No kata-related turns or friction anywhere in the review session
