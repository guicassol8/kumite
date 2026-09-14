# Task #261 (implementing) — kata out of frame, docs-only change

**Found while**: implementing #261 (document the gate ladder as a manual
contract for agents without Claude Code's hooks)
**Where in kata**: n/a

## What

No kata surface was touched. The task edited only `docs/workflow.md`, adding
a section that *names* `kata verify --strict-coverage` as one of the three
gate-ladder commands, but the string was copied verbatim from the existing
`.claude/hooks/stop.sh` — no `kata-docs` MCP lookup, no `kata verify` run
(docs changes don't gate on it), no hurl, no DI/JWT/error surface involved.

## Why it matters

Plain observation for the metrics trail: not every "implementing" task that
mentions kata by name in its diff actually exercises kata. Zero tokens/turns
spent on kata-docs here, and that's the correct amount for a docs-only PR.

## Metrics

- kata-docs queries: 0
- `kata verify` runs: 0 (no code paths touched, no gate applicable)
- Extra turns from kata lookups: 0
