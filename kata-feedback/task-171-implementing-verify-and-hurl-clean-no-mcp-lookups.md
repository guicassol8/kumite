# kata verify + hurl clean run, no kata-docs lookups needed

**Found while**: implementing #171 (test-isolation fix in
`password-reset.test.ts`, stubbing argon2 hash cost in two
`requestPasswordReset` tests)
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`

## What

Pure Vitest/argon2 fix — no route, schema, DI, or JWT surface touched, so
zero `kata-docs` MCP lookups were needed or attempted. Ran the full gate
ladder (`pnpm dev:back` + `pnpm hurl` to dirty the seeded DB, matching the
issue's repro condition) and `kata verify --strict-coverage` as part of the
pre-commit hook; both were clean on the first try, no false positives, no
surprises.

## Why it matters

Confirms `kata verify` and `hurl` stay fast/quiet noise-wise on a test-only
change with no framework-surface delta — useful as a baseline data point
against the noisier kata-feedback entries from planning sessions.

## Metrics

0 kata-docs queries (task never touched kata's DI/JWT/error surfaces).
`kata verify --strict-coverage`: ~0.8s, 65 files, no findings. `pnpm hurl`:
15/15 files, 301 requests, ~8.2s, no findings. No overhead beyond the
gate ladder itself.
