# Pure front e2e spec fix — kata never came into frame

**Found while**: implementing #251 (aligning `leaderboard.spec.ts` with the
#250 participation filter)
**Where in kata**: n/a

## What

The whole change was one Playwright spec file in `front/e2e/`, reordering two
assertions and renaming a screenshot — no back route, no schema, no DI/JWT
surface touched. `pnpm verify` (`kata verify --strict-coverage`) ran once as
part of the standard gate ladder and passed with "no problems found (65 files
checked)", but nothing about the fix required reasoning about kata itself —
the gate was a pass-through check, not a decision point. Zero `kata-docs` MCP
queries made.

## Why it matters

Another data point (see the other `task-*-*-kata-out-of-frame*.md` entries
from planning sessions) that a meaningful slice of kumite tasks — anything
scoped to `front/e2e/` or `front/src/` alone — never touches kata at all
during implementation either, not just during planning. Confirms the
"attempt every time" instruction is working as intended (a clean "nothing to
report" is still a report) rather than the entry being skipped silently.

## Metrics

- `kata-docs` queries: 0
- Tokens/turns spent on kata: none beyond the routine `pnpm verify` gate call
  (single command, instant pass, no output to parse or act on)
- Friction: none
