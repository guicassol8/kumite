# Reviewing a Vitest isolation fix — kata never in frame, verify+hurl still clean signal

**Found while**: reviewing PR #172 (fixes #171 — argon2 hash cost leaking
across `requestPasswordReset` tests when the DB is seeded/hurl-dirtied)
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`

## What

The fix itself is pure Vitest (a `withFastArgon2Hash` wrapper stubbing
`argon2.hash` around two heavy tests) — no route, schema, DI, or JWT
surface touched, so zero `kata-docs` MCP lookups were relevant during
review either. Reviewing it did require reproducing the exact repro
condition from the issue (seed + `hurl` to dirty the DB, then run the
back suite) to confirm the fix actually holds under the reported
conditions rather than trusting the PR's own test-plan narrative.

## Why it matters

`kata verify` and `hurl` served purely as gate-ladder steps here, not as
sources of insight — confirms (again) that the two tools stay fast/quiet
on changes with no kata-framework-surface delta, useful as another data
point in the same vein as the implementer's own entry for this PR
(`task-171-implementing-verify-and-hurl-clean-no-mcp-lookups.md`).

## Metrics

0 kata-docs queries. `pnpm verify`: ~1s, 65 files, no findings. `pnpm hurl`
(used here to reproduce the dirty-DB repro condition, not just as a gate):
15/15 files, 301 requests, ~10.7s, no findings. Full `pnpm -r test` after:
40+566+459 passed, ~2 min wall time. No kata friction encountered.
