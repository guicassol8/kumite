# kata verify clean end-to-end on a debounce/pub-sub back task (#44)

**Found while**: #44 — publish ranking updates on the SSE channel with a
1s debounce (module-state dirty flag reused from the existing expiry tick).
**Where in kata**: `kata verify --strict-coverage`, the PostToolUse/Stop hook
ladder.

## What

Six TDD steps across three modules (`sse.schema.ts`, `sse.service.ts`,
`sse.route.ts`, `main.ts`, `submissions.service.ts`,
`submissions.route.ts`) — new discriminated-union event variant, a
module-level in-memory dirty flag mirroring the existing anti-abuse
pattern in `submissions.service.ts`, and a second background tick wired
alongside `runExpiryTick`. `kata verify --strict-coverage` and the
pre-commit hook ladder (format → typecheck → verify → test) passed clean
on every one of the 6 commits, no false positives and no unresolvable
middleware/coverage warnings despite the route calling two async builder
functions sequentially before opening the SSE subscription.

No `kata-docs` MCP query was needed anywhere in this task — the plan
(written in a prior `planning-tasks` session) had already settled the
architecture, and every remaining question was pure kumite domain logic
(when does a submission move the leaderboard), not a kata framework
question.

## Why it matters

Another data point (see `verify-clean-on-mandatory-fk-refactor.md`,
`verify-on-schema-only-module.md`) that `kata verify --strict-coverage`
stays reliable and silent on ordinary back-module work, including a
pattern (two sequential `await` calls before a middleware-guarded stream
handler continues) that could plausibly have confused a static
DI-chain-resolution check.

## Metrics

- kata-docs queries: 0. Tokens spent on kata lookups: 0 (none attempted,
  none needed — the plan already had the framework-level decisions
  settled).
- `kata verify` / hook friction: none. Every commit's pre-commit ladder
  (format, typecheck, verify, full `pnpm -r test` — back 300+ tests, front
  246, blocks 40) passed on the first attempt at every one of the 6
  commits in this task.
