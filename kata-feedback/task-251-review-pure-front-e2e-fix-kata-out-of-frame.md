# Reviewing a pure front e2e spec fix — kata never came into frame

**Found while**: reviewing PR #254 (fixes #251, aligns `leaderboard.spec.ts`
with the #250 participation filter)
**Where in kata**: n/a

## What

Stage 1 and Stage 2 of the review were pure spec-compliance and Playwright
reasoning — comparing the new `leaderboard-empty` assertion against the sibling
`leaderboard-phantom-teams.spec.ts` and against `getRoundRanking`'s behavior in
`back/src/modules/sse/sse.service.ts`. Stage 3 evidence did run
`pnpm verify` (`kata verify --strict-coverage`) as part of the full gate
ladder, plus `pnpm -r test` and `pnpm -r typecheck` — all passed cleanly,
none surfaced anything to investigate. Zero `kata-docs` MCP queries: nothing
in this review touched DI, JWT, error surfaces, or hurl.

## Why it matters

Confirms the pattern already noted in
`task-251-implementing-pure-front-e2e-spec-kata-out-of-frame.md`: a
front/e2e-scoped change stays out of kata's frame through the *entire*
task lifecycle (planning → implementing → reviewing), not just one stage.
The `kata verify` gate is still worth running every time — it is cheap and
is the one signal that would catch an accidental back-surface regression —
but it never became a decision point here either.

## Metrics

- `kata-docs` queries: 0
- Tokens/turns spent on kata: none beyond the routine `pnpm verify` gate
  call (instant pass, "no problems found (65 files checked)")
- Friction: none
