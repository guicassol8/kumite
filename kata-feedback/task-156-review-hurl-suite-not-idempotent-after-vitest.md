# hurl is order- and state-coupled: the vitest suite poisons it, and kata offers no reset seam

**Found while**: reviewing #159 (task #156) — producing the mandatory back
evidence (`pnpm -r test` + `pnpm --filter @kumite/back hurl`).
**Where in kata**: the `hurl` integration surface (`kata`'s hurl story /
`--test` runner conventions), not `kata verify`.

## What

Running the two gates in the documented order — `pnpm -r test` first, then
`pnpm --filter @kumite/back hurl` — makes hurl fail, on a database that was
freshly migrated *and* seeded in between:

```
Failure src/modules/teams/teams.hurl (12 request(s) in 591 ms)
  teams.hurl:111  jsonpath "$.maxTeamSize" == 3
    actual:   integer <6>
    expected: integer <3>
Succeeded files: 12 (85.7%)   Failed files: 2 (14.3%)
```

Nothing in PR #159 touches a `.hurl` file. The cause is that the vitest suite
leaves the singleton `event_config` row at `max_team_size = 6`, and
`db:seed` cannot undo it — it writes the row with `onConflictDoNothing()`
(`back/src/db/seed.ts:206`), so a row that already exists keeps whatever the
last test mutated it to. Re-seeding *looks* like a reset and isn't. Dropping
the volume (`docker compose down -v` → migrate → seed) gives 14/14 green:

```
Executed files: 14   Succeeded files: 14 (100.0%)   Failed files: 0 (0.0%)
```

Two distinct hazards stacked here, and only the second is arguably kata's:

1. **kumite's own** — a seed that is additive rather than idempotent-by-reset.
   That is being tracked as kumite work, not filed against kata.
2. **kata's** — hurl files run in glob order (`src/modules/*/*.hurl`) against
   one shared, long-lived database, with no per-file setup/teardown seam and
   no notion of a fixture that must be restored. Each file is therefore
   responsible for hand-rolling its own cleanup, and `event-config.hurl` does
   (it PATCHes back to `{mixingLocked: false, maxTeamSize: 3}` as its last
   step) — but that cleanup only runs on the happy path. Any earlier assert
   failure in that file aborts it and leaves event-wide state mutated for
   every file that sorts after it. A green suite is the only case that
   cleans up after itself, which is exactly backwards.

## Why it matters

The failure presents as an unrelated module's assertion (`teams.hurl` saying
`maxTeamSize` is 6) with no pointer to the file that actually changed it, and
it reproduces only in a specific gate ordering. As a reviewer I spent the
bulk of this review's debugging budget proving it was pre-existing and not a
regression in the PR under review — the diff touches zero hurl files, so the
signal was pure noise against the thing I was there to check.

It also makes the mandatory evidence non-reproducible by default: an agent
following `AGENTS.md`'s own "Verify your work" order lands on a red hurl run
and has to know to nuke the volume first. That is a footgun for every kata
consumer that has any singleton/config table, which is most of them.

A per-file `[Setup]`/`[Teardown]` seam that runs regardless of assert
outcome, or a documented "reset to fixture" convention, would fix the class.
Filed as an observation — kumite worked around it by dropping the volume, and
the local seed bug is kumite's to fix.

## Metrics

- **kata-docs MCP lookups: 0.** Same as the implementation entry
  (`task-156-implementation-verify-blind-to-env-name-drift.md`): the diff is
  a userland env rename plus two docs files, and the review needed no kata
  API. Nothing to weigh a lookup against — correctly zero, twice in a row on
  this task.
- **`kata verify --strict-coverage`**: 1 run, clean, 61 files, ~1s. Correctly
  silent — no route, schema, DI or error surface in the diff.
- **Gate ladder in the review worktree**: typecheck ~40s (3 packages),
  verify ~1s, `pnpm -r test` 989 tests green in ~130s (back 517 / front 432 /
  blocks 40), hurl 293 requests in 8.1s.
- **Cost of the flake above**: 2 wasted hurl runs, one DB volume rebuild, and
  ~6 extra tool round-trips to attribute the failure to pre-existing state
  rather than to the PR. That is the single largest line item in this
  review's budget, and it was entirely environmental.
- **Confirming a Node semantic kata leaves to userland**: the PR's new
  `back/vitest.setup.ts` relies on `process.loadEnvFile()` not overriding a
  name already present in `process.env` (blank counts as present). Verified
  directly rather than trusted — `FOO='' node -e "process.loadEnvFile('.env')"`
  keeps `FOO` empty while filling `BAR` from the file, on Node v26.7.0. Worth
  recording because any kata app that parses env at import time depends on
  this to make its test suite overridable, and kata documents no position on
  it.
