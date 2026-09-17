# Env-validation error shape is app-land; kata's only role was the gate ladder

**Found while**: #97 — readable failure when a back env var is missing
**Where in kata**: none directly. `kata verify --strict-coverage` (pre-commit
job) and `pnpm hurl` were exercised; no kata API was called or consulted.

## What

The task replaced `EnvSchema.parse(process.env)` in `back/src/config.ts` (and
`SeedEnvSchema.parse` in `src/db/seed.ts`) with a local `parseEnv` helper that
collects every offending variable into one message. All of it is kumite-side
zod usage — kata neither provides nor constrains the app's env-validation
surface, so **zero `kata-docs` MCP queries were made**. Nothing was guessed
about kata either; there was simply no kata API in frame.

Two observations, both about the harness around the change rather than kata
itself:

1. **`kata verify --strict-coverage` stayed clean and fast** across four
   commits (0.72s – 1.57s each). Adding a new file under `src/lib/` and
   changing a module-level export in `config.ts` produced no findings and no
   false positives — correct, since neither touches routes, schemas or DI.
   Worth recording as a negative result: `lib/` utility modules do not trip
   the coverage rules.

2. **The gate ladder's `pnpm -r test` job is the memory bottleneck, again.**
   Two `git commit` invocations died with exit 137 (OOM kill) while other
   worktrees/dev servers were up — the machine had ~1.2 GiB available and
   3.8 GiB of swap in use. `back/`'s vitest config already sets
   `fileParallelism: false`; `front/`'s does not, and its jsdom workers are
   what tips it over. Setting `VITEST_MAX_THREADS=2 VITEST_MAX_FORKS=2` in the
   commit's environment made every subsequent run pass. This mirrors
   `review-140-gate-ladder-oom-and-hurl-tax-reconfirmed.md`; it is a kumite/
   harness issue, not a kata one, but it keeps costing turns.

## Why it matters

Point 1 is reassurance for future tasks: a pure helper in `back/src/lib/` is
outside `kata verify`'s remit, so nobody needs to consult kata-docs before
adding one. Point 2 is the recurring tax — an OOM-killed commit looks exactly
like a real gate failure (no test output, just `Exit status 137`), and this
session burned roughly three turns and one machine reboot distinguishing the
two. The tell is documented in kumite's own notes but not anywhere an agent
reads by default.

## Metrics

- **kata-docs MCP queries: 0.** Nothing in the task's surface was kata-shaped,
  and no lookup was skipped-and-guessed either — the question never arose.
  Token cost of kata lookups: 0 of the task's total.
- `kata verify --strict-coverage`: 4 runs, 0.72s / 1.57s / 1.10s / 0.84s. No
  findings, no false positives.
- `pnpm hurl`: 14 files, 293 requests, ~6s. Green **only after** a manual
  `truncate ... restart identity cascade` + `db:seed`. The first run failed 2
  files (`event-config.hurl`, `teams.hurl`) purely on leftover
  `event_config.maxTeamSize=6` from an earlier run — `db:seed` uses
  `onConflictDoNothing` and never resets that row. Cost: ~3 turns to
  distinguish stale state from a real regression. Already tracked kumite-side
  (#161), noted here only because the hurl re-runnability tax shows up in
  nearly every back task's feedback file.
- Gate ladder wall-clock per commit: ~105–175s, of which `pnpm -r test` is
  ~88–133s.

## Suggested fix (optional)

None for kata. For kumite, the recurring one: whatever #161 does for
`event_config` would make `pnpm hurl` re-runnable without the manual truncate,
and a `maxWorkers` in `front/vitest.config.ts` would stop the pre-commit ladder
from OOM-killing itself on a loaded machine.
