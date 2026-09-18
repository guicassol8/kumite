# hurl has no teardown hook, so "clean up in the last step" only cleans up on green

**Found while**: kumite #161 — `db:seed` didn't reset `event_config` and the hurl
suite went red after the vitest suite
**Where in kata**: hurl integration (`kata`'s `pnpm hurl` convention —
`hurl --test --jobs 1 src/modules/*/*.hurl`)

## What

The kumite convention that kata's module layout encourages — one `.hurl` per
module, all of them run in one glob-ordered pass against one shared database —
has no place to put teardown. A `.hurl` file is a flat list of requests: the
only way to restore state a file mutated is to append a "restore" request at
the end, and hurl aborts the file on the first failed assert. So the cleanup
runs exactly when it isn't needed (green run) and is skipped exactly when it
is (red run, which is the one that leaves state dirty for everyone after it).

Concretely in #161: `event-config.hurl` PATCHes the event-wide singleton to
non-default values mid-file and restores it as its last step. Break any assert
before that (we proved it by flipping step 3's `== 5` to `== 99`) and every
file that sorts after it inherits `maxTeamSize: 5`. `teams.hurl`, 10 files
later, asserted `maxTeamSize == 3` and failed with an error that pointed at
teams — nowhere near the actual cause. That misattribution cost a real
investigation during #159's review.

The fix available to a consumer is arrange-not-teardown: every file that
depends on shared state forces it at the top instead of trusting the previous
file. That works, but it's a discipline the framework can't enforce and
nothing warns about — the failure mode only shows up as a confusing red in an
unrelated module.

## Why it matters

Any kata consumer that follows the per-module `.hurl` layout against a shared
database hits this the moment two modules touch the same singleton row. The
symptom (assert failure in module B) is arbitrarily far from the cause
(aborted file in module A), and `--jobs 1` glob ordering makes it look
deterministic-but-inexplicable rather than obviously order-dependent.

## Metrics

- `kata-docs` MCP lookups this task: **zero**, in planning and in
  implementation. The problem was 100% application state (a drizzle
  `onConflictDoNothing()` and hurl file ordering); no kata API was in
  question, so there was nothing the docs could have answered. Guessing
  wasn't involved either — this was reading kumite's own code.
- Where the time actually went: database resets. Proving AC2 ("no
  `docker compose down -v` between vitest and hurl") and then demonstrating
  AC3 (deliberate mid-file failure) each needed a fully known-state database,
  which meant `down -v` → `up -d` → `db:migrate` → `db:seed` → restart the
  server → run the suite. Three full cycles, ~2 min of wall clock each, plus
  a restart-the-server dance because the running API holds a pool to the
  volume that just got deleted.
- `kata verify` / the PostToolUse hook: no friction, no false positives — the
  diff is a drizzle call, two `.hurl` files and a unit test, none of which the
  rules had anything to say about.

## Suggested fix (optional)

Not required, and the arrange-first pattern is a fine consumer-side answer.
If kata ever wants to help here: a per-file teardown section that runs
regardless of outcome (a `[Teardown]`-style block, or a convention where
`<module>.teardown.hurl` always runs after `<module>.hurl`) would let files
restore shared state honestly. Failing that, a line in kata's hurl docs
saying "your `.hurl` files share a database and abort on first failure —
arrange the state you depend on, never rely on a previous file's cleanup"
would have saved the #159 investigation.
